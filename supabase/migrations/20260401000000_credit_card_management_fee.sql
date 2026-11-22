-- ==============================================================================
-- MIGRATION: 20260401000000_credit_card_management_fee.sql
-- DESCRIPTION: Añadir soporte para valor de cuota de manejo (NUMERIC(12,2))
--              y modalidades de cobro en tarjetas de crédito (public.accounts)
-- ==============================================================================

-- 1. Añadir columnas a public.accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS management_fee NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS management_fee_type TEXT DEFAULT NULL;

-- 2. Migrar registros preexistentes de tarjetas de crédito a exentas por defecto
UPDATE public.accounts
SET
  management_fee = 0.00,
  management_fee_type = 'exempt'
WHERE account_type = 'credit_card'
  AND (management_fee IS NULL OR management_fee_type IS NULL);

-- Para cuentas bancarias y efectivo, asegurar que queden estrictamente NULL
UPDATE public.accounts
SET
  management_fee = NULL,
  management_fee_type = NULL
WHERE account_type IN ('cash', 'bank');

-- 3. Crear restricción de integridad para cuotas de manejo
ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_management_fee_rules;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_management_fee_rules CHECK (
    (
      account_type = 'credit_card'
      AND management_fee IS NOT NULL
      AND management_fee >= 0
      AND management_fee_type IS NOT NULL
      AND management_fee_type IN ('fixed_monthly', 'only_on_use', 'exempt_if_used', 'exempt')
    )
    OR
    (
      account_type IN ('cash', 'bank')
      AND management_fee IS NULL
      AND management_fee_type IS NULL
    )
  );

-- 4. Recrear vista credit_card_balance_summary con los campos de cuota de manejo
DROP VIEW IF EXISTS public.credit_card_balance_summary CASCADE;

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
  a.management_fee,
  a.management_fee_type,
  COALESCE(
    SUM(t.amount) FILTER (WHERE t.transaction_type = 'expense' AND t.is_paid = FALSE),
    0
  ) AS unpaid_expenses_total,
  COALESCE(
    SUM(t.amount) FILTER (WHERE t.transaction_type = 'expense'),
    0
  ) AS total_expenses,
  COALESCE(
    (
      SELECT SUM(s.total_amount)
      FROM public.credit_card_statements s
      WHERE s.account_id = a.id
        AND s.is_paid = TRUE
    ),
    0
  ) AS total_statements_paid
FROM public.accounts a
LEFT JOIN public.transactions t ON t.account_id = a.id AND t.user_id = a.user_id
WHERE a.account_type = 'credit_card'
GROUP BY
  a.id,
  a.user_id,
  a.name,
  a.credit_limit,
  a.closing_day,
  a.payment_due_day,
  a.current_balance,
  a.management_fee,
  a.management_fee_type;

GRANT SELECT ON public.credit_card_balance_summary TO authenticated;
