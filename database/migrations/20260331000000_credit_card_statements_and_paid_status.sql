-- ==============================================================================
-- Migration: 20260331000000_credit_card_statements_and_paid_status.sql
-- Description: Soporte para marcado de transacciones/cuotas pagadas,
--              tabla de control de extractos mensuales de tarjeta de crédito
--              y vista de coherencia de saldos.
-- ==============================================================================

-- 1. Agregar campos de estado de pago en public.transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Índice para consultas rápidas de transacciones activas/pendientes de pago
CREATE INDEX IF NOT EXISTS transactions_account_paid_idx
  ON public.transactions(account_id, is_paid);

-- 2. Crear tabla para el registro y control formal de extractos mensuales
CREATE TABLE IF NOT EXISTS public.credit_card_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  statement_month TEXT NOT NULL CHECK (statement_month ~ '^\d{4}-\d{2}$'), -- Formato YYYY-MM
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT statements_account_owner
    FOREIGN KEY (user_id, account_id)
    REFERENCES public.accounts(user_id, id) ON DELETE CASCADE,

  CONSTRAINT statements_unique_account_month
    UNIQUE (user_id, account_id, statement_month)
);

-- Índices para búsquedas de extractos por usuario y tarjeta
CREATE INDEX IF NOT EXISTS statements_user_account_idx
  ON public.credit_card_statements(user_id, account_id);

CREATE INDEX IF NOT EXISTS statements_period_idx
  ON public.credit_card_statements(statement_month, is_paid);

-- Trigger de updated_at para extractos
CREATE TRIGGER statements_updated_at
BEFORE UPDATE ON public.credit_card_statements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Habilitar RLS estricto en credit_card_statements
ALTER TABLE public.credit_card_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY statements_select_own ON public.credit_card_statements
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY statements_insert_own ON public.credit_card_statements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY statements_update_own ON public.credit_card_statements
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY statements_delete_own ON public.credit_card_statements
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Permisos para usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.credit_card_statements
TO authenticated;

-- 3. Vista de auditoría y coherencia de saldos de tarjetas de crédito
CREATE OR REPLACE VIEW public.credit_card_balance_summary
WITH (security_invoker = true)
AS
SELECT
  a.id AS account_id,
  a.user_id,
  a.name,
  a.credit_limit,
  a.closing_day,
  a.payment_due_day,
  a.current_balance,
  COALESCE(
    SUM(t.amount) FILTER (WHERE t.transaction_type = 'expense' AND t.is_paid = FALSE),
    0
  ) AS unpaid_expenses_total
FROM public.accounts a
LEFT JOIN public.transactions t ON t.account_id = a.id AND t.user_id = a.user_id
WHERE a.account_type = 'credit_card'
GROUP BY a.id, a.user_id, a.name, a.credit_limit, a.closing_day, a.payment_due_day, a.current_balance;

GRANT SELECT ON public.credit_card_balance_summary TO authenticated;
