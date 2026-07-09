-- Supabase Schema for Water Transport Manager

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'broker', 'driver', 'conductor')),
  name TEXT,
  phone TEXT,
  personnel_id TEXT, -- Link to personnel table if applicable
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vehicles Table
CREATE TABLE public.vehicles (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  plate TEXT NOT NULL,
  type TEXT,
  capacity TEXT,
  status TEXT DEFAULT 'Active'
);

-- 3. Personnel Table
CREATE TABLE public.personnel (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- Driver, Conductor, Both
  phone TEXT,
  id_number TEXT,
  notes TEXT,
  rate NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active'
);

-- 4. Locations Table
CREATE TABLE public.locations (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  distance NUMERIC,
  default_rate NUMERIC DEFAULT 0
);

-- 5. Trips Table
CREATE TABLE public.trips (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  date DATE NOT NULL,
  lorry TEXT NOT NULL,
  trip_number TEXT,
  location TEXT,
  revenue NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  amount_paid NUMERIC DEFAULT 0,
  driver_id TEXT REFERENCES public.personnel(id),
  conductor_id TEXT REFERENCES public.personnel(id),
  odometer_start NUMERIC,
  odometer_end NUMERIC,
  expenses JSONB DEFAULT '{}'::jsonb,
  deductions JSONB DEFAULT '{}'::jsonb,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  earnings_rate NUMERIC,
  earnings_amount NUMERIC
);

-- 6. Maintenance Table
CREATE TABLE public.maintenance (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  date DATE NOT NULL,
  lorry TEXT NOT NULL,
  type TEXT,
  cost NUMERIC DEFAULT 0,
  description TEXT,
  odometer NUMERIC,
  next_service_date DATE,
  status TEXT DEFAULT 'completed',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Loans Table
CREATE TABLE public.loans (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  personnel_id TEXT REFERENCES public.personnel(id),
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  type TEXT DEFAULT 'advance',
  reason TEXT,
  status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Complaints Table
CREATE TABLE public.complaints (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  date DATE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'low',
  status TEXT DEFAULT 'open',
  reported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Settings Table
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Settlements Table
CREATE TABLE public.settlements (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  method TEXT DEFAULT 'Cash',
  notes TEXT,
  linked_trips JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Broker Ledger Table
CREATE TABLE public.broker_ledger (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  trip_id TEXT REFERENCES public.trips(id) ON DELETE CASCADE,
  settlement_id TEXT REFERENCES public.settlements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Personnel Ledger Table
CREATE TABLE public.personnel_ledger (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  trip_id TEXT REFERENCES public.trips(id) ON DELETE CASCADE,
  personnel_id TEXT REFERENCES public.personnel(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_ledger ENABLE ROW LEVEL SECURITY;

-- Helper Function to check user role
CREATE OR REPLACE FUNCTION public.user_role() RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: Admins can do anything. Users can read/write their own profile.
CREATE POLICY "Profiles are viewable by self and admins" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Profiles are editable by self and admins" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.user_role() IN ('admin', 'owner'));

-- Read Access for all authenticated users for basic reference tables
CREATE POLICY "Read access for authenticated users on vehicles" ON public.vehicles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Read access for authenticated users on locations" ON public.locations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Read access for authenticated users on personnel" ON public.personnel FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Read access for authenticated users on settings" ON public.settings FOR SELECT USING (auth.role() = 'authenticated');

-- Write Access for admins/owners on reference tables
CREATE POLICY "Admin write access vehicles" ON public.vehicles USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Admin write access locations" ON public.locations USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Admin write access personnel" ON public.personnel USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Admin write access settings" ON public.settings USING (public.user_role() IN ('admin', 'owner'));

-- Trips:
-- - Admins/Owners: Full Access
-- - Broker: Read Access
-- - Driver/Conductor: Can insert (pending) and view their own trips
CREATE POLICY "Admin full access trips" ON public.trips USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Broker read trips" ON public.trips FOR SELECT USING (public.user_role() = 'broker');
CREATE POLICY "Personnel insert trips" ON public.trips FOR INSERT WITH CHECK (public.user_role() IN ('driver', 'conductor'));
CREATE POLICY "Personnel read own trips" ON public.trips FOR SELECT USING (
  public.user_role() IN ('driver', 'conductor') 
  AND 
  (driver_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid()) 
   OR conductor_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid()))
);

-- Broker Ledger & Settlements: Admins full, Brokers read
CREATE POLICY "Admin full access broker_ledger" ON public.broker_ledger USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Broker read broker_ledger" ON public.broker_ledger FOR SELECT USING (public.user_role() = 'broker');

CREATE POLICY "Admin full access settlements" ON public.settlements USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Broker read settlements" ON public.settlements FOR SELECT USING (public.user_role() = 'broker');

-- Personnel Ledger: Admins full, Drivers/Conductors read their own
CREATE POLICY "Admin full access personnel_ledger" ON public.personnel_ledger USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Personnel read own ledger" ON public.personnel_ledger FOR SELECT USING (
  personnel_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid())
);

-- Maintenance, Loans, Complaints: Admins full access. 
CREATE POLICY "Admin full access maintenance" ON public.maintenance USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Admin full access loans" ON public.loans USING (public.user_role() IN ('admin', 'owner'));
CREATE POLICY "Admin full access complaints" ON public.complaints USING (public.user_role() IN ('admin', 'owner'));
