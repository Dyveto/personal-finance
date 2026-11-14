import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Finance | Control Financiero",
  description: "Sistema Web de Finanzas Personales, Cuentas, Tarjetas de Crédito y Proyecciones",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased font-sans dark:bg-slate-950 dark:text-slate-50">
        {children}
      </body>
    </html>
  );
}
