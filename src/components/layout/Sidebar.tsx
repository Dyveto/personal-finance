"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  ShieldCheck,
  LogOut,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/features/auth/actions/auth-actions";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { APP_VERSION } from "@/config/version";
import { BrandLogo } from "@/components/shared/BrandLogo";

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
  {
    name: "Categorías",
    href: "/categories",
    icon: Tag,
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      if (onNavigate) onNavigate();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("SignOut error:", err);
    }
  };

  const currentPath = pathname || "";

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white dark:bg-[#131B2E] text-slate-800 dark:text-[#F8FAFC] border-r border-slate-200 dark:border-white/[0.08] w-64 select-none transition-colors duration-300",
        className
      )}
      aria-label="Barra lateral de navegación"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 h-20 border-b border-slate-200 dark:border-white/[0.08]">
        <BrandLogo variant="full" size="md" href="/" priority />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-[#94A3B8] uppercase">
          Menú Principal
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? currentPath === "/" || currentPath === "/dashboard"
              : currentPath.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ease-smooth",
                isActive
                  ? "bg-amber-500/15 text-amber-700 dark:text-[#D4AF37] border border-amber-500/30 dark:border-amber-400/30 font-semibold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                  : "text-slate-600 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-amber-700 dark:text-[#D4AF37]" : "text-slate-400 dark:text-[#94A3B8]"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Status Card & Sign Out */}
      <div className="p-4 border border-slate-200 dark:border-white/[0.08] m-3 rounded-2xl bg-slate-50/80 dark:bg-[#0B0F19]/60 space-y-3 transition-colors">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#10B981]">
              <ShieldCheck className="w-4 h-4" />
              <span>RLS & Seguridad Activa</span>
            </div>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-[#94A3B8] border border-slate-300/80 dark:border-white/[0.06] tracking-tight">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] leading-relaxed">
            Datos aislados por usuario y cálculos con precisión decimal en COP.
          </p>
        </div>

        {/* Selector de Modo Noche/Día (Dark Mode / Light Mode) */}
        <ThemeToggle />

        {/* Botón de Cerrar Sesión */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#F43F5E] hover:text-white hover:bg-[#F43F5E]/15 border border-[#F43F5E]/25 transition-all duration-300 ease-smooth"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
