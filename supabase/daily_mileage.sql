-- =========================================================================
-- Mount Kenya Water Distributors - Daily Mileage Tracking Table
-- =========================================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor) to provision
-- the daily_mileage table, indexes, unique constraints, and Row Level Security.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Daily Mileage Table
CREATE TABLE IF NOT EXISTS public.daily_mileage (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  vehicle_plate TEXT NOT NULL,
  mileage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  kilometers_covered NUMERIC NOT NULL CHECK (kilometers_covered >= 0),
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure only one record per vehicle per date
  CONSTRAINT unique_vehicle_daily_mileage UNIQUE (vehicle_id, mileage_date)
);

-- 2. Indexes for fast filtering & searching
CREATE INDEX IF NOT EXISTS idx_daily_mileage_date ON public.daily_mileage (mileage_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_mileage_vehicle ON public.daily_mileage (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_daily_mileage_plate ON public.daily_mileage (vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_daily_mileage_created_at ON public.daily_mileage (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.daily_mileage ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Authenticated users (admin, owner, driver, conductor) can read mileage records
DROP POLICY IF EXISTS "Authenticated users view daily_mileage" ON public.daily_mileage;
CREATE POLICY "Authenticated users view daily_mileage" 
ON public.daily_mileage 
FOR SELECT 
USING (
  auth.role() = 'authenticated'
);

-- Authenticated users can insert mileage records
DROP POLICY IF EXISTS "Authenticated users insert daily_mileage" ON public.daily_mileage;
CREATE POLICY "Authenticated users insert daily_mileage" 
ON public.daily_mileage 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated'
);

-- Admins and owners can update any mileage record; creators can update their own
DROP POLICY IF EXISTS "Authorized users update daily_mileage" ON public.daily_mileage;
CREATE POLICY "Authorized users update daily_mileage" 
ON public.daily_mileage 
FOR UPDATE 
USING (
  public.user_role() IN ('admin', 'owner') OR auth.uid() = created_by
)
WITH CHECK (
  public.user_role() IN ('admin', 'owner') OR auth.uid() = created_by
);

-- Admins and owners can delete mileage records
DROP POLICY IF EXISTS "Admins delete daily_mileage" ON public.daily_mileage;
CREATE POLICY "Admins delete daily_mileage" 
ON public.daily_mileage 
FOR DELETE 
USING (
  public.user_role() IN ('admin', 'owner')
);

-- 5. Updated at trigger
CREATE OR REPLACE FUNCTION update_daily_mileage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_daily_mileage_updated_at ON public.daily_mileage;
CREATE TRIGGER trigger_daily_mileage_updated_at
BEFORE UPDATE ON public.daily_mileage
FOR EACH ROW
EXECUTE FUNCTION update_daily_mileage_updated_at();

-- 6. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_mileage;
