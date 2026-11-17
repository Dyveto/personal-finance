import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Finance | Control Financiero",
  description: "Sistema Web de Finanzas Personales, Cuentas, Tarjetas de Crédito y Proyecciones",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0B0F19",
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
    <html lang="es" className="dark h-full">
      <body className="h-full bg-[#0B0F19] text-[#F8FAFC] antialiased font-sans selection:bg-[#8B5CF6]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
