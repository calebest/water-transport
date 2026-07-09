-- ==========================================
-- 1. Create the Trigger Function
-- ==========================================
-- This function runs every time a new user is created in Supabase Auth.
-- It automatically creates a corresponding row in the public.profiles table.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'broker'), -- Default role is broker if not provided
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'), -- Default name
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 2. Attach the Trigger to auth.users
-- ==========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 3. Backfill Existing Users (Fix for your current account)
-- ==========================================
-- This will create profile rows for any users that already exist in auth.users
-- but are missing from public.profiles.

INSERT INTO public.profiles (id, role, name, phone)
SELECT
  id,
  'admin', -- We assume your existing account without a profile should be an admin
  COALESCE(raw_user_meta_data->>'name', 'Admin User'),
  COALESCE(raw_user_meta_data->>'phone', '')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
