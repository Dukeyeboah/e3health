import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E3Health · Health & beauty",
  description: "Browse health and beauty essentials from E3Health.",
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
