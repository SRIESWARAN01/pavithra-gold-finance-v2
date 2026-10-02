// src/middleware.ts
// Next.js Edge Middleware — rate limiting on auth endpoints + CORS hardening.
// Runs at the CDN edge BEFORE any API route handler executes.

import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// In-memory rate limiter (per-IP, sliding window)
// For production at scale, replace with Redis or Upstash Rate Limit.
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;      // Max 20 auth/payment requests per minute per IP
const API_RATE_LIMIT_MAX = 60;           // Max 60 general API requests per minute per IP

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(key: string, maxRequests: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return true;
  }

  return false;
}

// Clean up stale entries periodically (prevent unbounded memory growth)
if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  };
  // Run cleanup every 5 minutes
  if (typeof setInterval !== 'undefined') {
    setInterval(cleanup, 5 * 60 * 1000);
  }
}

// ---------------------------------------------------------------------------
// Allowed origins for CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  // Add your production domain here:
  // 'https://pavithra-gold-finance.web.app',
  // 'https://your-custom-domain.com',
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Same-origin requests don't send Origin header
  return ALLOWED_ORIGINS.has(origin);
}

// ---------------------------------------------------------------------------
// Security headers applied to all responses
// ---------------------------------------------------------------------------
function addSecurityHeaders(response: NextResponse, origin: string | null): NextResponse {
  // CORS headers — only allow whitelisted origins
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key');
    response.headers.set('Access-Control-Max-Age', '86400'); // Cache preflight for 24h
  }

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

// ---------------------------------------------------------------------------
// Middleware handler
// ---------------------------------------------------------------------------
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');

  // Handle CORS preflight (OPTIONS) immediately
  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      return new NextResponse(null, { status: 403 });
    }
    const response = new NextResponse(null, { status: 204 });
    return addSecurityHeaders(response, origin);
  }

  // Block non-whitelisted origins on API routes
  if (pathname.startsWith('/api/') && origin && !isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: 'CORS_BLOCKED: Origin not allowed.' },
      { status: 403 }
    );
  }

  const clientIp = getClientIp(req);

  // Stricter rate limiting on authentication-related endpoints
  const isAuthEndpoint =
    pathname.includes('/api/admin/onboard') ||
    pathname.includes('/api/auth') ||
    pathname.includes('/api/login');

  if (isAuthEndpoint) {
    const rateLimitKey = `auth:${clientIp}`;
    if (isRateLimited(rateLimitKey, RATE_LIMIT_MAX_REQUESTS)) {
      return NextResponse.json(
        { error: 'RATE_LIMITED: Too many authentication requests. Please wait before retrying.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  // General API rate limiting
  if (pathname.startsWith('/api/')) {
    const rateLimitKey = `api:${clientIp}`;
    if (isRateLimited(rateLimitKey, API_RATE_LIMIT_MAX)) {
      return NextResponse.json(
        { error: 'RATE_LIMITED: Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  // Proceed with the request, adding security headers
  const response = NextResponse.next();
  return addSecurityHeaders(response, origin);
}

// Only run middleware on API routes and auth-related pages
export const config = {
  matcher: [
    '/api/:path*',
  ],
};
