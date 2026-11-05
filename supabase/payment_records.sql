-- =========================================================================
-- Mount Kenya Water Distributors - Payment Records Table
-- =========================================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor) to provision
-- the payment_records table, indexes, and Row Level Security policies.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Payment Records Table
CREATE TABLE IF NOT EXISTS public.payment_records (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  recipient_name TEXT NOT NULL,
  recipient_category TEXT DEFAULT 'Boss / Director',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TEXT NOT NULL,
  description TEXT DEFAULT '',
  payment_method TEXT DEFAULT 'Cash',
  reference_number TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- In case table was already created, ensure recipient_category column exists
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS recipient_category TEXT DEFAULT 'Boss / Director';

-- 2. Indexes for fast filtering & searching
CREATE INDEX IF NOT EXISTS idx_payment_records_date ON public.payment_records (date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_records_recipient ON public.payment_records (recipient_name);
CREATE INDEX IF NOT EXISTS idx_payment_records_created_at ON public.payment_records (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Only authorized administrators and owners can insert, update, or delete records.
DROP POLICY IF EXISTS "Admin full access payment_records" ON public.payment_records;
CREATE POLICY "Admin full access payment_records" 
ON public.payment_records 
FOR ALL 
USING (
  public.user_role() IN ('admin', 'owner')
)
WITH CHECK (
  public.user_role() IN ('admin', 'owner')
);

-- Allow authenticated users to view records (view-only users cannot modify)
DROP POLICY IF EXISTS "Authenticated users view payment_records" ON public.payment_records;
CREATE POLICY "Authenticated users view payment_records" 
ON public.payment_records 
FOR SELECT 
USING (
  auth.role() = 'authenticated'
);

-- 5. Updated at trigger
CREATE OR REPLACE FUNCTION update_payment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_records_updated_at ON public.payment_records;
CREATE TRIGGER trigger_payment_records_updated_at
BEFORE UPDATE ON public.payment_records
FOR EACH ROW
EXECUTE FUNCTION update_payment_records_updated_at();

-- 6. Clean slate: No demo payment records are inserted.
-- Any previous demo records are cleaned up for a fresh operational start:
DELETE FROM public.payment_records 
WHERE id LIKE 'demo-pmt-%' 
   OR (description IN ('Payment', 'Fuel advance', 'Weekly allowance', 'Spare parts / expense') AND reference_number IN ('REF-0615-01', 'QHD78239JS', 'REF-0620-02', 'TXN-98421'));

-- =========================================================================
-- 7. Bosses / Directors Table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.bosses (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL UNIQUE,
  title TEXT DEFAULT 'Director',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on bosses table
ALTER TABLE public.bosses ENABLE ROW LEVEL SECURITY;

-- Admins full access
DROP POLICY IF EXISTS "Admin full access bosses" ON public.bosses;
CREATE POLICY "Admin full access bosses" 
ON public.bosses 
FOR ALL 
USING (
  public.user_role() IN ('admin', 'owner')
)
WITH CHECK (
  public.user_role() IN ('admin', 'owner')
);

-- Authenticated users can view
DROP POLICY IF EXISTS "Authenticated users view bosses" ON public.bosses;
CREATE POLICY "Authenticated users view bosses" 
ON public.bosses 
FOR SELECT 
USING (
  auth.role() = 'authenticated'
);

-- Insert initial seed bosses
INSERT INTO public.bosses (name, title, phone, notes)
VALUES 
  ('John', 'Director', '+254 712 345 678', 'Executive Director'),
  ('Peter', 'Managing Director', '+254 723 456 789', 'Operations & Fleet'),
  ('David', 'Director / Shareholder', '+254 734 567 890', 'Partner & Finance')
ON CONFLICT (name) DO NOTHING;

