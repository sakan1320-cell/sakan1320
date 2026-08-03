-- Add a foreign key to profiles so PostgREST schema cache knows the relationship
ALTER TABLE public.system_errors 
ADD CONSTRAINT system_errors_user_id_profiles_fk 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
