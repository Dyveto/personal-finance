import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata = {
  title: "Dashboard Financiero | Personal Finance",
  description: "Sistema Web de Finanzas Personales y Control de Tarjetas de Crédito",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
