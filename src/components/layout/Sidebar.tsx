"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  ShieldCheck,
  TrendingUp,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/features/auth/actions/auth-actions";

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
        "flex flex-col h-full bg-[#131B2E] text-[#F8FAFC] border-r border-white/[0.08] w-64 select-none",
        className
      )}
      aria-label="Barra lateral de navegación"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-white/[0.08]">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#8B5CF6] text-white font-bold shadow-[0_0_15px_rgba(139,92,246,0.35)]">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-heading font-bold tracking-tight text-[#F8FAFC] block text-sm">
            Personal Finance
          </span>
          <span className="text-[11px] font-medium text-[#94A3B8] block -mt-0.5 tracking-wider uppercase">
            COP Edition
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-[#94A3B8] uppercase">
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
                  ? "bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30 font-semibold shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-[#94A3B8] hover:bg-white/[0.05] hover:text-[#F8FAFC]"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-[#8B5CF6]" : "text-[#94A3B8]"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Status Card & Sign Out */}
      <div className="p-4 border border-white/[0.08] m-3 rounded-2xl bg-[#0B0F19]/60 space-y-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#10B981] mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>RLS & Seguridad Activa</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Datos aislados por usuario y cálculos con precisión decimal en COP.
          </p>
        </div>

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
