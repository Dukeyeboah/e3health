import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E3Health · Your everyday stock companion",
  description: "Simple stock management, clear pricing, and a beautiful product catalog.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
