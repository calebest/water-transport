-- Run this in Supabase SQL Editor (Database > SQL Editor)

-- Step 1: Grant the postgres role permission to delete auth users
GRANT DELETE ON auth.users TO postgres;

-- Step 2: Create/replace the function
-- It explicitly deletes the profile first, then the auth user.
CREATE OR REPLACE FUNCTION delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is an admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized: only admins can delete users';
  END IF;

  -- Step 1: Delete the profile row first (this always works)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Step 2: Delete the auth user (removes login access entirely)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
