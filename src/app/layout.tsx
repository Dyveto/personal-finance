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
    <html lang="es" className="dark h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem('theme');
                if (storedTheme === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="h-full bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-[#F8FAFC] antialiased font-sans selection:bg-[#8B5CF6]/30 selection:text-white transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
