CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL
    CHECK (account_type IN ('cash', 'bank', 'credit_card')),
  institution TEXT,
  currency TEXT NOT NULL DEFAULT 'COP',
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(12,2),
  closing_day INTEGER,
  payment_due_day INTEGER,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT accounts_credit_rules CHECK (
    (
      account_type = 'credit_card'
      AND closing_day BETWEEN 1 AND 31
      AND payment_due_day BETWEEN 1 AND 31
      AND credit_limit IS NOT NULL
      AND credit_limit > 0
    )
    OR
    (
      account_type IN ('cash', 'bank')
      AND closing_day IS NULL
      AND payment_due_day IS NULL
      AND credit_limit IS NULL
    )
  )
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_type TEXT NOT NULL
    CHECK (category_type IN ('income', 'expense')),
  icon TEXT,
  color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT categories_unique_name
    UNIQUE (user_id, name, category_type),

  CONSTRAINT categories_unique_owner_id
    UNIQUE (user_id, id)
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  category_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  transaction_type TEXT NOT NULL
    CHECK (transaction_type IN ('income', 'expense')),
  transaction_date DATE NOT NULL,
  is_installment BOOLEAN NOT NULL DEFAULT FALSE,
  installment_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT transactions_installment_rules CHECK (
    installment_count >= 1
    AND is_installment = (installment_count > 1)
  ),

  CONSTRAINT transactions_account_owner
    FOREIGN KEY (user_id, account_id)
    REFERENCES public.accounts(user_id, id),

  CONSTRAINT transactions_category_owner
    FOREIGN KEY (user_id, category_id)
    REFERENCES public.categories(user_id, id)
);

CREATE INDEX accounts_user_idx
  ON public.accounts(user_id);

CREATE INDEX categories_user_idx
  ON public.categories(user_id);

CREATE INDEX transactions_user_date_idx
  ON public.transactions(user_id, transaction_date DESC);

CREATE INDEX transactions_account_idx
  ON public.transactions(account_id);

CREATE INDEX transactions_category_idx
  ON public.transactions(category_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed de categorías por defecto al registrar un usuario
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.categories
    (user_id, name, category_type, icon, is_default)
  VALUES
    (NEW.id, 'Salary', 'income', 'wallet', TRUE),
    (NEW.id, 'Freelance', 'income', 'laptop', TRUE),
    (NEW.id, 'Investments', 'income', 'chart', TRUE),
    (NEW.id, 'Other income', 'income', 'plus-circle', TRUE),
    (NEW.id, 'Food', 'expense', 'utensils', TRUE),
    (NEW.id, 'Transport', 'expense', 'car', TRUE),
    (NEW.id, 'Housing', 'expense', 'home', TRUE),
    (NEW.id, 'Health', 'expense', 'heart', TRUE),
    (NEW.id, 'Entertainment', 'expense', 'film', TRUE),
    (NEW.id, 'Shopping', 'expense', 'shopping-bag', TRUE),
    (NEW.id, 'Education', 'expense', 'book', TRUE),
    (NEW.id, 'Other expenses', 'expense', 'more-horizontal', TRUE);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_categories
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_default_categories();

-- Habilitar RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad (RLS) para Accounts
CREATE POLICY accounts_select_own ON public.accounts FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY accounts_insert_own ON public.accounts FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY accounts_update_own ON public.accounts FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY accounts_delete_own ON public.accounts FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Políticas de seguridad (RLS) para Categories
CREATE POLICY categories_select_own ON public.categories FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY categories_insert_own ON public.categories FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY categories_update_own ON public.categories FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY categories_delete_own ON public.categories FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Políticas de seguridad (RLS) para Transactions
CREATE POLICY transactions_select_own ON public.transactions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY transactions_insert_own ON public.transactions FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY transactions_update_own ON public.transactions FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY transactions_delete_own ON public.transactions FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.accounts, public.categories, public.transactions
TO authenticated;