-- Run this in Supabase SQL Editor (Database > SQL Editor)
-- Allows drivers and conductors to edit (update) and delete their own unapproved submissions (pending or rejected).

-- 1. Policy for updating own unapproved trips
DROP POLICY IF EXISTS "Personnel update own unapproved trips" ON public.trips;
CREATE POLICY "Personnel update own unapproved trips" ON public.trips 
FOR UPDATE 
USING (
  (public.user_role() IN ('driver', 'conductor') OR auth.role() = 'authenticated')
  AND 
  (
    created_by = auth.uid() 
    OR driver_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid()) 
    OR conductor_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid())
  )
  AND 
  approval_status IN ('pending', 'rejected', 'pending_edit')
)
WITH CHECK (
  (public.user_role() IN ('driver', 'conductor') OR auth.role() = 'authenticated')
  AND 
  (
    created_by = auth.uid() 
    OR driver_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid()) 
    OR conductor_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid())
  )
  AND 
  approval_status IN ('pending', 'rejected', 'pending_edit')
);

-- 2. Policy for deleting own unapproved trips
DROP POLICY IF EXISTS "Personnel delete own unapproved trips" ON public.trips;
CREATE POLICY "Personnel delete own unapproved trips" ON public.trips 
FOR DELETE 
USING (
  (public.user_role() IN ('driver', 'conductor') OR auth.role() = 'authenticated')
  AND 
  (
    created_by = auth.uid() 
    OR driver_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid()) 
    OR conductor_id = (SELECT personnel_id FROM public.profiles WHERE id = auth.uid())
  )
  AND 
  approval_status IN ('pending', 'rejected')
);
