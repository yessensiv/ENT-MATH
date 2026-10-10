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
      <body className="antialiased">
        {(process.env.VERCEL==='1'||process.env.ENT_DEPLOY_TARGET==='vercel')&&<aside role="status" style={{padding:'12px 20px',background:'#fff3d9',color:'#594117',textAlign:'center'}}>Предварительная версия Vercel: уроки доступны. Вход, ИИ и сохранение прогресса пока не подключены. Учебная история основного сайта сохранена.</aside>}
        {children}
      </body>
    </html>
  );
}
