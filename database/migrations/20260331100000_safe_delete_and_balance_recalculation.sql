-- ==============================================================================
-- Migration: 20260331100000_safe_delete_and_balance_recalculation.sql
-- Description: Integridad referencial en cascada para eliminación segura de cuentas,
--              función y triggers de recálculo preciso de saldos en cuentas y
--              tarjetas de crédito, e índices de alto rendimiento.
-- ==============================================================================

-- 1. Actualizar llave foránea de transactions -> accounts con ON DELETE CASCADE
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_account_owner;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_account_owner
  FOREIGN KEY (user_id, account_id)
  REFERENCES public.accounts(user_id, id)
  ON DELETE CASCADE;

-- 2. Función de recálculo determinístico de saldos por cuenta
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
  -- Verificar existencia y pertenencia de la cuenta respetando RLS si auth.uid() está definido
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

  -- Si la cuenta no existe o fue eliminada, salir pacíficamente
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Calcular el nuevo saldo según la naturaleza de la cuenta
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
              SELECT SUM(total_amount)
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

  -- Actualizar el saldo actual de la cuenta
  UPDATE public.accounts
  SET current_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = target_account_id;

  RETURN v_new_balance;
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.recalculate_account_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_account_balance(UUID) TO service_role;

-- 3. Triggers para sincronización automática de saldos

-- 3.1 Trigger para transacciones
CREATE OR REPLACE FUNCTION public.trg_sync_account_balance_on_transaction()
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
    ELSIF OLD.amount <> NEW.amount 
       OR OLD.transaction_type <> NEW.transaction_type
       OR OLD.is_paid <> NEW.is_paid THEN
      PERFORM public.recalculate_account_balance(NEW.account_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_sync_balance ON public.transactions;

CREATE TRIGGER trg_transactions_sync_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_account_balance_on_transaction();

-- 3.2 Trigger para extractos de tarjeta de crédito
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
    ELSIF OLD.total_amount <> NEW.total_amount OR OLD.is_paid <> NEW.is_paid THEN
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

-- 4. Índices optimizados para recálculo instantáneo
CREATE INDEX IF NOT EXISTS transactions_account_type_amount_idx
  ON public.transactions(account_id, transaction_type)
  INCLUDE (amount, is_paid);

CREATE INDEX IF NOT EXISTS statements_account_paid_amount_idx
  ON public.credit_card_statements(account_id, is_paid)
  INCLUDE (total_amount);

-- 5. Actualizar vista de balance summary con métricas de auditoría
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
GROUP BY a.id, a.user_id, a.name, a.credit_limit, a.closing_day, a.payment_due_day, a.current_balance;

GRANT SELECT ON public.credit_card_balance_summary TO authenticated;
