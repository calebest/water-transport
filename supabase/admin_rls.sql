-- Allow admins and owners to read, insert, update, and delete all personal records
CREATE POLICY "Admins manage all personal records" 
ON public.personal_records 
FOR ALL 
USING (public.user_role() IN ('admin', 'owner'));
