import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import IntroSplash from "@/components/IntroSplash";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pavithra Gold Finance — Enterprise Gold Loan Management",
  description: "India's premier digital gold loan management platform. Real-time loan tracking, automated interest calculation, secure collateral management, and transparent payment histories.",
  keywords: ["gold loan", "pawn broking", "gold finance", "loan management", "PGF"],
  authors: [{ name: "Pavithra Gold Finance" }],
  openGraph: {
    title: "Pavithra Gold Finance — Enterprise Gold Loan Management",
    description: "India's premier digital gold loan management platform with real-time loan tracking and secure collateral management.",
    type: "website",
    siteName: "Pavithra Gold Finance",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pavithra Gold Finance",
    description: "India's premier digital gold loan management platform.",
  },
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-inter bg-[#F8FAFC] text-gray-900">
        <IntroSplash />
        {children}
      </body>
    </html>
  );
}
