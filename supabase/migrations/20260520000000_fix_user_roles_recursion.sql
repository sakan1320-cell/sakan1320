-- Create helper function to check if a user can manage roles without recursion
CREATE OR REPLACE FUNCTION public.can_manage_roles(_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
      AND role IN ('system_admin'::public.app_role, 'executive'::public.app_role)
  );
$$;

-- Drop recursive policy and recreate using the helper function
DROP POLICY IF EXISTS "user_roles_manage" ON public.user_roles;
CREATE POLICY "user_roles_manage"
  ON public.user_roles FOR ALL
  USING (
    public.can_manage_roles(auth.uid())
  );
