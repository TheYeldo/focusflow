import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Level List",
  description: "A playful task board with XP, levels, progress and sounds.",
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
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
