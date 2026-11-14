
# PROJECT CONTEXT — PERSONAL FINANCE SYSTEM

Version: 1.0
Status: AUTHORITATIVE
Timezone: America/Bogota
Default currency: COP

---

# 1. PRODUCT DEFINITION

Build a personal finance application with:

- User authentication.
- Bank accounts and cash accounts.
- Credit cards.
- Income and expense transactions.
- Custom and predefined categories.
- Installment purchases.
- Credit card billing cycles.
- Statement closing dates.
- Payment due dates.
- Monthly financial projections.
- Financial dashboard.
- PWA support.

The system is multi-user. Every user's data must remain isolated.

---

# 2. DATABASE CONTRACT

## 2.1 accounts

Represents bank accounts, cash accounts and credit cards.

Columns:

- id: UUID PRIMARY KEY.
- user_id: UUID REFERENCES auth.users(id).
- name: TEXT NOT NULL.
- account_type: TEXT NOT NULL.
- institution: TEXT NULL.
- currency: TEXT DEFAULT 'COP'.
- initial_balance: NUMERIC(12,2) DEFAULT 0.
- current_balance: NUMERIC(12,2) DEFAULT 0.
- credit_limit: NUMERIC(12,2) NULL.
- closing_day: INTEGER NULL.
- payment_due_day: INTEGER NULL.
- color: TEXT NULL.
- is_active: BOOLEAN DEFAULT TRUE.
- created_at: TIMESTAMPTZ.
- updated_at: TIMESTAMPTZ.

account_type allowed values:

- cash
- bank
- credit_card

Rules:

- Credit card accounts require closing_day and payment_due_day.
- Both days must be between 1 and 31.
- Credit limit must be positive.
- Credit card current_balance represents outstanding debt.
- Bank and cash current_balance represents available money.
- A credit card's current_balance must not be interpreted as available money.

## 2.2 categories

Columns:

- id: UUID PRIMARY KEY.
- user_id: UUID REFERENCES auth.users(id).
- name: TEXT NOT NULL.
- category_type: TEXT NOT NULL.
- icon: TEXT NULL.
- color: TEXT NULL.
- is_default: BOOLEAN DEFAULT FALSE.
- created_at: TIMESTAMPTZ.

category_type:

- income
- expense

A category belongs to exactly one user.

Unique constraint:

(user_id, name, category_type)

## 2.3 transactions

Columns:

- id: UUID PRIMARY KEY.
- user_id: UUID REFERENCES auth.users(id).
- account_id: UUID REFERENCES accounts(id).
- category_id: UUID REFERENCES categories(id).
- description: TEXT NOT NULL.
- amount: NUMERIC(12,2) NOT NULL.
- transaction_type: TEXT NOT NULL.
- transaction_date: DATE NOT NULL.
- is_installment: BOOLEAN DEFAULT FALSE.
- installment_count: INTEGER DEFAULT 1.
- notes: TEXT NULL.
- created_at: TIMESTAMPTZ.
- updated_at: TIMESTAMPTZ.

transaction_type:

- income
- expense

Rules:

- amount must be greater than zero.
- installment_count must be >= 1.
- installment_count must be 1 for non-installment transactions.
- is_installment must correspond to installment_count > 1.
- An expense assigned to a credit card increases its outstanding debt.
- An expense assigned to a bank or cash account reduces available balance.
- Income increases bank/cash balance.
- Income cannot be registered against a credit card.
- The category must belong to the same user.
- The account must belong to the same user.

For the first version, each installment purchase is stored as ONE
transaction. Installments are projected mathematically and are NOT
stored as separate transactions.

---

# 3. INITIAL SQL MIGRATION

The DB agent must implement this schema in a timestamped migration.

```sql
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

-- Automatically update updated_at.

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

-- Seed categories for each newly registered user.

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

-- Enable RLS.

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Accounts policies.

CREATE POLICY accounts_select_own
ON public.accounts
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY accounts_insert_own
ON public.accounts
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY accounts_update_own
ON public.accounts
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY accounts_delete_own
ON public.accounts
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Categories policies.

CREATE POLICY categories_select_own
ON public.categories
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY categories_insert_own
ON public.categories
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY categories_update_own
ON public.categories
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY categories_delete_own
ON public.categories
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Transactions policies.

CREATE POLICY transactions_select_own
ON public.transactions
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY transactions_insert_own
ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY transactions_update_own
ON public.transactions
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY transactions_delete_own
ON public.transactions
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Grant authenticated users the necessary table operations.

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.accounts, public.categories, public.transactions
TO authenticated;
```

Additional mandatory DB checks:

- Review Supabase default privileges.
- Do not grant anonymous access.
- Do not allow a user to change the owner of a record.
- Ensure the trigger function has only the privileges it needs.
- Verify RLS using two different authenticated users.
- Never disable RLS to make an application query work.

---

# 4. FINANCIAL BUSINESS LOGIC

## 4.1 Monetary calculations

All monetary calculations must use decimal arithmetic.

For example:

Purchase: 100000 COP
Installments: 3

Expected installment amounts:

- 33333.34
- 33333.33
- 33333.33

Total: 100000.00

The first installment receives any rounding remainder.

Invariant:

SUM(installments) = original purchase amount.

Never use floating-point division as the final monetary result.

## 4.2 Calendar rules

Use civil dates in YYYY-MM-DD format.

Timezone: America/Bogota.

Do not use UTC conversions to determine billing days.

Implement date functions using calendar dates, not milliseconds divided by 86400000.

If a configured closing or due day does not exist in a given month,
use the last calendar day of that month.

Example:

Closing day: 31
February 2027 closing date: 2027-02-28.

## 4.3 Statement closing date

Input:

- Purchase date.
- Card closing_day.

Algorithm:

1. Read the purchase month and day.
2. If purchase day <= closing_day:
   closing date = closing_day in the purchase month.
3. Otherwise:
   closing date = closing_day in the following month.
4. Clamp closing day to the last valid day of the target month.

The purchase on the closing date belongs to that statement.

Example:

Card closing day: 20.

Purchase: March 15.
Statement close: March 20.

Purchase: March 20.
Statement close: March 20.

Purchase: March 21.
Statement close: April 20.

## 4.4 Payment due date

Input:

- Calculated statement closing date.
- Card closing_day.
- Card payment_due_day.

Algorithm:

1. If payment_due_day > closing_day:
   payment month = closing month.
2. Otherwise:
   payment month = month immediately following closing month.
3. Set payment date to payment_due_day in that month.
4. Clamp to the last valid calendar day.

Examples:

Closing day: 20.
Payment day: 5.
Purchase: March 15.
Statement: March 20.
Payment due: April 5.

Closing day: 5.
Payment day: 25.
Purchase: March 3.
Statement: March 5.
Payment due: March 25.

Closing day: 31.
Payment day: 31.
Closing: February 28.
Payment due: March 31.

These rules are the initial product convention. Card issuers can have different arrangements, so the application must make these settings editable.

## 4.5 Installment projections

A purchase is stored once in transactions.

Example:

Purchase date: 2026-11-10.
Amount: 1,200,000 COP.
Installments: 6.
Closing day: 15.
Payment day: 5.

Installment amount:

200,000 COP.

The first installment belongs to the statement calculated from the purchase date.

Each subsequent installment belongs to the next monthly statement.

Expected projection:

- November statement: 200,000.
- December statement: 200,000.
- January statement: 200,000.
- February statement: 200,000.
- March statement: 200,000.
- April statement: 200,000.

Each projected installment must contain:

- Original transaction ID.
- Installment number.
- Installment amount.
- Statement closing date.
- Payment due date.
- Statement month.

The projection must not create duplicate transactions.

## 4.6 Monthly card projection

For each card and future month:

1. Find installment purchases.
2. Determine their first statement.
3. Generate the remaining installment dates.
4. Group installments by statement closing date.
5. Sum the amounts.
6. Calculate the corresponding payment due date.
7. Return the total amount expected for each payment period.

A purchase with one installment must also be included.

Do not include installments already assigned to previous statements.

## 4.7 Account balances

For bank and cash accounts:

current balance =
initial balance
+ income
- expenses.

For credit cards:

outstanding debt =
initial outstanding debt
+ card purchases
- payments.

Important:

The first implementation must document how opening balances are represented.

Do not silently double-count transactions when recalculating balances.

Credit card payments are NOT ordinary income. They must eventually be modeled as transfers between a bank account and a credit card.

The first CRUD implementation must not invent transfer semantics. Record this as a pending domain feature in DECISIONS.md.

---

# 5. BACKEND CONTRACTS

Expected financial functions:

src/lib/finance/
  money.ts
  calendar.ts
  credit-card.ts
  installments.ts
  projections.ts

Expected public functions:

calculateStatementClosingDate(
  purchaseDate: string,
  closingDay: number
): string;

calculatePaymentDueDate(
  closingDate: string,
  closingDay: number,
  paymentDueDay: number
): string;

splitInstallments(
  amount: string,
  installmentCount: number
): string[];

calculateInstallmentSchedule(
  transaction: InstallmentPurchase,
  card: CreditCardConfig
): InstallmentProjection[];

calculateMonthlyProjection(
  purchases: InstallmentPurchase[],
  card: CreditCardConfig,
  startDate: string,
  months: number
): MonthlyProjection[];

All public contracts must be documented and tested.

Use the exact names or document approved changes in DECISIONS.md.

---

# 6. SECURITY AND DATA ACCESS

The server must derive user identity from the authenticated Supabase session.

Never accept user_id as authoritative input from the client.

All inserts must validate:
- Account ownership.
- Category ownership.
- Transaction type compatibility.
- Installment consistency.
- Amount validity.

Never bypass RLS for normal user operations.

Use service_role only for trusted administrative operations.

---

# 7. DEFINITION OF DONE

The product is not complete until:

- Database migrations execute successfully.
- RLS tests pass.
- Authentication works.
- Server-side validation works.
- No TypeScript errors exist.
- ESLint passes.
- Production build succeeds.
- Financial calculations pass Vitest.
- No money is lost through rounding.
- No installments are duplicated.
- QA approves the implementation.

The QA agent has final verification authority.
