import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance",
  description: "Keep Track, Assess, and Enhance Your Financial Performance",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finance",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
      </head>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
