import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FocusFlow",
  description:
    "Стеклянный level-organizer для задач, дедлайнов, фокуса, достижений и мягких звуков.",
  openGraph: {
    title: "FocusFlow",
    description:
      "Премиальная стеклянная доска задач с уровнями, достижениями и мобильной навигацией.",
    type: "website",
  },
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
