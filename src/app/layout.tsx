import type { Metadata, Viewport } from "next";
import { AppearanceProvider } from "@/components/ui/appearance-provider";
import "./globals.css";

export const metadata: Metadata = {
  icons: { icon: "/logo-yacelltech.svg" },
  title: "YacellTech SalesBoard | Ranking de Puntos en Tiempo Real",
  description:
    "Sistema moderno de ranking y estadísticas de puntos para YacellTech.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://salesboard.yacelltech.com"
  ),
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F5F7" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('salesboard-theme')==='dark'?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}` }} /></head>
      <body className="font-sans antialiased">
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
