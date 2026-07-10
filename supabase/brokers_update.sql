-- ==========================================
-- 1. Create Brokers Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.brokers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. Modify Existing Tables to link to Brokers
-- ==========================================
-- Add broker_id to trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS broker_id TEXT REFERENCES public.brokers(id);

-- Add broker_id to broker_ledger
ALTER TABLE public.broker_ledger ADD COLUMN IF NOT EXISTS broker_id TEXT REFERENCES public.brokers(id);

-- Add broker_id to settlements
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS broker_id TEXT REFERENCES public.brokers(id);


-- ==========================================
-- 3. Row Level Security (RLS) for Brokers
-- ==========================================
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read access for authenticated users on brokers" 
ON public.brokers FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin write access brokers" 
ON public.brokers USING (public.user_role() IN ('admin', 'owner'));

-- Note: We assume that public.user_role() already exists in your schema.
-- If not, it was created during initial setup.
