import type { Metadata } from "next";
import "./globals.css";
import "./appearance.css";

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
        {(process.env.VERCEL==='1'||process.env.ENT_DEPLOY_TARGET==='vercel')&&!(process.env.AUTH_GOOGLE_ID&&process.env.AUTH_GOOGLE_SECRET&&process.env.AUTH_SECRET&&process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN)&&<aside role="status" style={{padding:'12px 20px',background:'#fff3d9',color:'#594117',textAlign:'center'}}>Подключаем вход Google и сохранение прогресса. Учебная история основного сайта сохранена.</aside>}
        {children}
      </body>
    </html>
  );
}
