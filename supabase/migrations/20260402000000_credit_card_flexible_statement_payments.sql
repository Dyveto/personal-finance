-- ==============================================================================
-- MIGRATION: 20260402000000_credit_card_flexible_statement_payments.sql
-- DESCRIPTION: Soporte para pagos flexibles de extractos de tarjetas de crédito
--              (pago mínimo, total, personalizado), registro de cuenta de origen,
--              transacción de débito y recálculo determinístico de saldos.
-- ==============================================================================

-- 1. Agregar nuevas columnas a public.credit_card_statements
ALTER TABLE public.credit_card_statements
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS minimum_payment NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_account_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID DEFAULT NULL;

-- 2. Claves foráneas con integridad de usuario (owner isolation)
ALTER TABLE public.credit_card_statements
  DROP CONSTRAINT IF EXISTS statements_payment_account_owner;

ALTER TABLE public.credit_card_statements
  ADD CONSTRAINT statements_payment_account_owner
  FOREIGN KEY (user_id, payment_account_id)
  REFERENCES public.accounts(user_id, id)
  ON DELETE SET NULL;

ALTER TABLE public.credit_card_statements
  DROP CONSTRAINT IF EXISTS statements_payment_tx_owner;

ALTER TABLE public.credit_card_statements
  ADD CONSTRAINT statements_payment_tx_owner
  FOREIGN KEY (user_id, payment_transaction_id)
  REFERENCES public.transactions(user_id, id)
  ON DELETE SET NULL;

-- 3. Backfill seguro para extractos preexistentes marcados como pagados
UPDATE public.credit_card_statements
SET
  paid_amount = total_amount,
  payment_type = 'full',
  minimum_payment = total_amount
WHERE is_paid = TRUE AND paid_amount IS NULL;

-- 4. Restricción de integridad CHECK para consistencia de pagos
ALTER TABLE public.credit_card_statements
  DROP CONSTRAINT IF EXISTS statements_payment_rules;

ALTER TABLE public.credit_card_statements
  ADD CONSTRAINT statements_payment_rules CHECK (
    (
      is_paid = TRUE
      AND paid_amount IS NOT NULL
      AND paid_amount > 0
      AND payment_type IS NOT NULL
      AND payment_type IN ('minimum', 'full', 'custom')
    )
    OR
    (
      is_paid = FALSE
      AND (paid_amount IS NULL OR paid_amount = 0)
      AND payment_type IS NULL
    )
  );

-- 5. Actualizar la función de recálculo determinístico de saldos por cuenta
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(target_account_id UUID)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_type TEXT;
  v_initial_balance NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT account_type, initial_balance
    INTO v_account_type, v_initial_balance
    FROM public.accounts
    WHERE id = target_account_id AND user_id = auth.uid();
  ELSE
    SELECT account_type, initial_balance
    INTO v_account_type, v_initial_balance
    FROM public.accounts
    WHERE id = target_account_id;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_account_type IN ('cash', 'bank') THEN
    SELECT ROUND(
      v_initial_balance + COALESCE(
        SUM(
          CASE
            WHEN transaction_type = 'income' THEN amount
            WHEN transaction_type = 'expense' THEN -amount
            ELSE 0
          END
        ),
        0
      ),
      2
    )
    INTO v_new_balance
    FROM public.transactions
    WHERE account_id = target_account_id;

  ELSIF v_account_type = 'credit_card' THEN
    SELECT ROUND(
      GREATEST(
        0,
        v_initial_balance
        + COALESCE(
            SUM(amount) FILTER (WHERE transaction_type = 'expense'),
            0
          )
        - COALESCE(
            (
              SELECT SUM(COALESCE(paid_amount, total_amount))
              FROM public.credit_card_statements
              WHERE account_id = target_account_id
                AND is_paid = TRUE
            ),
            0
          )
      ),
      2
    )
    INTO v_new_balance
    FROM public.transactions
    WHERE account_id = target_account_id;

  ELSE
    RETURN NULL;
  END IF;

  UPDATE public.accounts
  SET current_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = target_account_id;

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_account_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_account_balance(UUID) TO service_role;

-- 6. Actualizar trigger en credit_card_statements para incluir paid_amount
CREATE OR REPLACE FUNCTION public.trg_sync_account_balance_on_statement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_account_balance(NEW.account_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_account_balance(OLD.account_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.account_id <> NEW.account_id THEN
      PERFORM public.recalculate_account_balance(OLD.account_id);
      PERFORM public.recalculate_account_balance(NEW.account_id);
    ELSIF OLD.total_amount <> NEW.total_amount 
       OR OLD.is_paid <> NEW.is_paid 
       OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
      PERFORM public.recalculate_account_balance(NEW.account_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_statements_sync_balance ON public.credit_card_statements;

CREATE TRIGGER trg_statements_sync_balance
AFTER INSERT OR UPDATE OR DELETE ON public.credit_card_statements
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_account_balance_on_statement();

-- 7. Actualizar la vista credit_card_balance_summary
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
      SELECT SUM(COALESCE(s.paid_amount, s.total_amount))
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
