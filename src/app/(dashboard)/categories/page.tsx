import {
  listCategories,
  getCategoryUsageCounts,
} from "@/features/categories/actions/category-actions";
import { CategoriesClientView } from "@/features/categories/components/CategoriesClientView";
import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "Categorías | Personal Finance",
  description: "Administración y personalización de categorías de ingresos y gastos.",
};

export default async function CategoriesPage() {
  const [categoriesResult, usageResult] = await Promise.all([
    listCategories(),
    getCategoryUsageCounts(),
  ]);

  const usageCounts = usageResult.success ? usageResult.data : {};

  if (!categoriesResult.success) {
    const isAuthError = categoriesResult.error.includes("Unauthorized");

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Administración de Categorías
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1">
            Personaliza iconos, colores y nombres para organizar tus ingresos y gastos.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
              {isAuthError ? "Inicio de sesión requerido" : "Aviso al cargar categorías"}
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {isAuthError
                ? "Debes iniciar sesión con Supabase Auth para ver y gestionar tus categorías privadas."
                : categoriesResult.error}
            </p>
          </div>
        </div>

        <CategoriesClientView initialCategories={[]} initialUsageCounts={{}} />
      </div>
    );
  }

  return (
    <CategoriesClientView
      initialCategories={categoriesResult.data}
      initialUsageCounts={usageCounts}
    />
  );
}
