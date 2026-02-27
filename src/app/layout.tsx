import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Playwright Task Runner | Web Automation",
  description: "A sleek, high-performance web automation platform powered by Playwright and Fastify.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${outfit.variable} antialiased selection:bg-blue-500/30 selection:text-blue-200`}
      >
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
