-- Add missing lorry columns to support vehicle-specific direct expenses and settlements
ALTER TABLE public.broker_ledger ADD COLUMN IF NOT EXISTS lorry TEXT;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS lorry TEXT;

-- Use DO blocks to safely add policies only if they don't exist, preventing errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'broker_ledger' AND policyname = 'Admin update broker_ledger'
    ) THEN
        CREATE POLICY "Admin update broker_ledger" ON public.broker_ledger 
        FOR UPDATE USING (public.user_role() IN ('admin', 'owner'));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'settlements' AND policyname = 'Admin update settlements'
    ) THEN
        CREATE POLICY "Admin update settlements" ON public.settlements 
        FOR UPDATE USING (public.user_role() IN ('admin', 'owner'));
    END IF;
END
$$;

-- RELOAD SUPABASE API CACHE (Crucial step!)
-- Supabase caches the database schema. If we don't reload it, the API will ignore the new lorry column!
NOTIFY pgrst, 'reload schema';
