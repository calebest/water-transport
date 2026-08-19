-- Allow admins and owners to INSERT into profiles
CREATE POLICY "Profiles are insertable by admins" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.user_role() IN ('admin', 'owner'));
