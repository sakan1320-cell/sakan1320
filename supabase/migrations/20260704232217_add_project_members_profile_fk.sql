-- Add a foreign key to profiles so PostgREST schema cache knows the relationship
ALTER TABLE public.project_members 
ADD CONSTRAINT project_members_user_id_profiles_fk 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
