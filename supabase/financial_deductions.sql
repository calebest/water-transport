-- =========================================================================
-- Mount Kenya Water Distributors - Financial Reconciliation & Deductions Table
-- =========================================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor) to provision
-- the financial_deductions table, indexes, and Row Level Security policies.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Financial Deductions Table
CREATE TABLE IF NOT EXISTS public.financial_deductions (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Vehicle Repairs & Maintenance',
  reference_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  included_in_trips BOOLEAN NOT NULL DEFAULT FALSE,
  allocated_boss TEXT DEFAULT 'All Bosses',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast filtering & searching
CREATE INDEX IF NOT EXISTS idx_financial_deductions_date ON public.financial_deductions (date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_deductions_category ON public.financial_deductions (category);
CREATE INDEX IF NOT EXISTS idx_financial_deductions_included ON public.financial_deductions (included_in_trips);
CREATE INDEX IF NOT EXISTS idx_financial_deductions_created_at ON public.financial_deductions (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.financial_deductions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Only authorized administrators and owners can insert, update, or delete deductions.
DROP POLICY IF EXISTS "Admin full access financial_deductions" ON public.financial_deductions;
CREATE POLICY "Admin full access financial_deductions" 
ON public.financial_deductions 
FOR ALL 
USING (
  public.user_role() IN ('admin', 'owner')
)
WITH CHECK (
  public.user_role() IN ('admin', 'owner')
);

-- Allow authenticated users to view deductions (view-only users cannot modify)
DROP POLICY IF EXISTS "Authenticated users view financial_deductions" ON public.financial_deductions;
CREATE POLICY "Authenticated users view financial_deductions" 
ON public.financial_deductions 
FOR SELECT 
USING (
  auth.role() = 'authenticated'
);

-- 5. Updated at trigger
CREATE OR REPLACE FUNCTION update_financial_deductions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_financial_deductions_updated_at ON public.financial_deductions;
CREATE TRIGGER trigger_financial_deductions_updated_at
BEFORE UPDATE ON public.financial_deductions
FOR EACH ROW
EXECUTE FUNCTION update_financial_deductions_updated_at();
