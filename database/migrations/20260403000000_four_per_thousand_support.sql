-- ==============================================================================
-- MIGRATION: 20260403000000_four_per_thousand_support.sql
-- DESCRIPTION: Soporte para 4x1000 (Gravamen a los Movimientos Financieros - GMF)
--              por cuenta bancaria y trazabilidad de monto base e impuesto
--              en transacciones de egreso.
-- ==============================================================================

-- 1. Añadir columna has_four_per_thousand a public.accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS has_four_per_thousand BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Restricción de integridad:
--    Solo cuentas tipo 'bank' pueden tener has_four_per_thousand = TRUE.
--    Tarjetas de crédito ('credit_card') y efectivo ('cash') deben ser FALSE.
ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_four_per_thousand_rules;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_four_per_thousand_rules CHECK (
    (account_type = 'bank')
    OR
    (account_type IN ('cash', 'credit_card') AND has_four_per_thousand = FALSE)
  );

-- 3. Añadir columnas de trazabilidad a public.transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS four_per_thousand_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_four_per_thousand_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- Restricción para asegurar montos no negativos
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_four_per_thousand_rules;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_four_per_thousand_rules CHECK (
    four_per_thousand_amount IS NULL OR four_per_thousand_amount >= 0
  );

-- 4. Índices para alto desempeño en consultas
CREATE INDEX IF NOT EXISTS accounts_four_per_thousand_idx
  ON public.accounts(user_id)
  WHERE has_four_per_thousand = TRUE;

CREATE INDEX IF NOT EXISTS transactions_four_per_thousand_idx
  ON public.transactions(user_id, is_four_per_thousand_applied)
  WHERE is_four_per_thousand_applied = TRUE;
