-- ==============================================================================
-- Migration: 20260331300000_user_preferences_and_dashboard_layout.sql
-- Description: Tabla de preferencias de usuario y disposición personalizada
--              de widgets en el Dashboard con seguridad estricta RLS e indexación.
-- ==============================================================================

-- 1. Crear tabla de preferencias de usuario
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_layout JSONB NOT NULL DEFAULT '{
    "widget_order": [
      "kpi_summary",
      "financial_charts",
      "installment_projections",
      "active_accounts",
      "recent_transactions"
    ],
    "visible_widgets": [
      "kpi_summary",
      "financial_charts",
      "installment_projections",
      "active_accounts",
      "recent_transactions"
    ],
    "collapsed_widgets": []
  }'::jsonb,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
  currency TEXT NOT NULL DEFAULT 'COP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id),
  CONSTRAINT user_preferences_unique_owner_id UNIQUE (user_id, id)
);

-- 2. Índices de rendimiento para búsquedas por usuario y consultas JSONB
CREATE INDEX IF NOT EXISTS user_preferences_user_idx
  ON public.user_preferences(user_id);

CREATE INDEX IF NOT EXISTS user_preferences_dashboard_layout_idx
  ON public.user_preferences USING gin (dashboard_layout);

-- 3. Trigger para updated_at automático
DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Trigger para inicializar preferencias por defecto al registrar usuario
CREATE OR REPLACE FUNCTION public.create_default_user_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_preferences
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_default_user_preferences();

-- 5. Habilitar y configurar Row Level Security (RLS) estricto
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_preferences_delete_own ON public.user_preferences;
CREATE POLICY user_preferences_delete_own ON public.user_preferences
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Permisos para el rol authenticated
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.user_preferences
TO authenticated;
