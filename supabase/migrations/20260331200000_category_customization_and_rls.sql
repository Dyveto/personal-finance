-- ==============================================================================
-- Migration: 20260331200000_category_customization_and_rls.sql
-- Description: Soporte integral para la gestión y personalización de categorías
--              por usuario con estricto aislamiento de seguridad (RLS),
--              auditoría con updated_at, estado activo/inactivo y seed en español.
-- ==============================================================================

-- 1. Agregar campos de auditoría y estado a public.categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Trigger para actualizar updated_at automáticamente en public.categories
DROP TRIGGER IF EXISTS categories_updated_at ON public.categories;
CREATE TRIGGER categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Índices de rendimiento para búsquedas y filtros por usuario, tipo y estado
CREATE INDEX IF NOT EXISTS categories_user_type_idx
  ON public.categories(user_id, category_type);

CREATE INDEX IF NOT EXISTS categories_user_active_idx
  ON public.categories(user_id, is_active);

-- 4. Actualizar función de seed de categorías por defecto en español
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.categories
    (user_id, name, category_type, icon, color, is_default, is_active)
  VALUES
    -- Ingresos
    (NEW.id, 'Salario', 'income', 'wallet', '#10B981', TRUE, TRUE),
    (NEW.id, 'Freelance', 'income', 'laptop', '#3B82F6', TRUE, TRUE),
    (NEW.id, 'Inversiones', 'income', 'trending-up', '#8B5CF6', TRUE, TRUE),
    (NEW.id, 'Otros Ingresos', 'income', 'plus-circle', '#06B6D4', TRUE, TRUE),
    -- Gastos
    (NEW.id, 'Alimentación', 'expense', 'utensils', '#F59E0B', TRUE, TRUE),
    (NEW.id, 'Transporte', 'expense', 'car', '#3B82F6', TRUE, TRUE),
    (NEW.id, 'Vivienda', 'expense', 'home', '#8B5CF6', TRUE, TRUE),
    (NEW.id, 'Salud', 'expense', 'heart', '#F43F5E', TRUE, TRUE),
    (NEW.id, 'Entretenimiento', 'expense', 'film', '#EC4899', TRUE, TRUE),
    (NEW.id, 'Compras', 'expense', 'shopping-bag', '#06B6D4', TRUE, TRUE),
    (NEW.id, 'Educación', 'expense', 'book', '#10B981', TRUE, TRUE),
    (NEW.id, 'Otros Gastos', 'expense', 'more-horizontal', '#64748B', TRUE, TRUE)
  ON CONFLICT (user_id, name, category_type) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Reafirmar y garantizar políticas RLS estrictas en public.categories
-- (Asegura aislamiento absoluto por auth.uid() y plena libertad para editar y eliminar)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select_own ON public.categories;
CREATE POLICY categories_select_own ON public.categories
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS categories_insert_own ON public.categories;
CREATE POLICY categories_insert_own ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS categories_update_own ON public.categories;
CREATE POLICY categories_update_own ON public.categories
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS categories_delete_own ON public.categories;
CREATE POLICY categories_delete_own ON public.categories
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Permisos explícitos para el rol authenticated
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.categories
TO authenticated;
