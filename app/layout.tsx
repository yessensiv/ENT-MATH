import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ENT Math — математика 5–11 классов и ЕНТ",
  description: "Математика 5–11 классов и подготовка к ЕНТ: понятные уроки, личный план, практика и разбор ошибок. На русском и казахском языках.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
