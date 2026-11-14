"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Cuentas",
    href: "/accounts",
    icon: Wallet,
  },
  {
    name: "Tarjetas de Crédito",
    href: "/credit-cards",
    icon: CreditCard,
  },
  {
    name: "Transacciones",
    href: "/transactions",
    icon: ArrowLeftRight,
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-slate-900 text-slate-100 border-r border-slate-800 w-64 select-none",
        className
      )}
      aria-label="Barra lateral de navegación"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20">
          <TrendingUp className="w-5 h-5 text-slate-950" />
        </div>
        <div>
          <span className="font-semibold tracking-tight text-white block text-sm">
            Personal Finance
          </span>
          <span className="text-xs text-slate-400 block -mt-0.5">COP Edition</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Menú Principal
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-500/15 text-emerald-400 shadow-sm border border-emerald-500/20 font-semibold"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-emerald-400" : "text-slate-400"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Status Card */}
      <div className="p-4 border-t border-slate-800 m-3 rounded-xl bg-slate-800/50">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>RLS & Seguridad Activa</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Datos aislados por usuario y cálculos con precisión decimal en COP.
        </p>
      </div>
    </aside>
  );
}
