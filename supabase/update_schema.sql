-- Update Loans Table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS amount_repaid NUMERIC DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- Create Loan Repayments Table
CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  loan_id TEXT REFERENCES public.loans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  method TEXT DEFAULT 'Cash',
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Personal Finance Table
CREATE TABLE IF NOT EXISTS public.personal_finance (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  type TEXT NOT NULL,
  person_name TEXT NOT NULL,
  category TEXT DEFAULT 'Personal',
  description TEXT,
  principal_amount NUMERIC DEFAULT 0,
  amount_added NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Open',
  start_date DATE,
  due_date DATE,
  method TEXT DEFAULT 'Cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Personal Finance Transactions Table
CREATE TABLE IF NOT EXISTS public.personal_finance_tx (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  record_id TEXT REFERENCES public.personal_finance(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  method TEXT DEFAULT 'Cash',
  notes TEXT,
  effect TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_finance_tx ENABLE ROW LEVEL SECURITY;

-- Policies (Admins full access)
CREATE POLICY "Admin full access loan_repayments" ON public.loan_repayments USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Admin full access personal_finance" ON public.personal_finance USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Admin full access personal_finance_tx" ON public.personal_finance_tx USING (public.user_role() IN ('admin', 'owner'));
