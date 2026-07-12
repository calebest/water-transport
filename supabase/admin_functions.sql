CREATE OR REPLACE FUNCTION delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is an admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Delete from auth.users (this will cascade to profiles)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
