-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    normalized_username TEXT UNIQUE,
    full_name TEXT,
    display_name_ar TEXT,
    display_name_en TEXT,
    phone TEXT,
    national_id TEXT UNIQUE,
    is_password_setup_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role)
);

-- 3. ESSENTIAL FUNCTION: Get Email by Username/ID
-- This is what fixes the "Login without Email" requirement
CREATE OR REPLACE FUNCTION public.get_user_email_by_identifier(_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    found_email TEXT;
BEGIN
    -- Search in profiles for username or national_id
    SELECT u.email INTO found_email
    FROM auth.users u
    JOIN public.profiles p ON u.id = p.id
    WHERE p.username = _identifier 
       OR p.national_id = _identifier 
       OR p.normalized_username = LOWER(_identifier)
    LIMIT 1;

    RETURN found_email;
END;
$$;

-- 4. ENTERPRISE TABLES (Support, Messaging, LMS)
CREATE TABLE IF NOT EXISTS public.message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT,
    thread_type TEXT DEFAULT 'direct',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES public.message_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS SETTINGS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- POLICIES (BASIC)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Roles are viewable by authenticated" ON public.user_roles;
CREATE POLICY "Roles are viewable by authenticated" ON public.user_roles FOR SELECT USING (auth.role() = 'authenticated');
