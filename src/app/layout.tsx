import type { Metadata } from "next";
import "./globals.css";
import IntroSplash from "@/components/IntroSplash";

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
      className="h-full antialiased"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Outfit:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-inter bg-[#F8FAFC] text-gray-900">
        <IntroSplash />
        {children}
      </body>
    </html>
  );
}
