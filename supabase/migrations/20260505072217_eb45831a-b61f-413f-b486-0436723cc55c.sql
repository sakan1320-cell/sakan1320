GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid, uuid) TO anon, authenticated;