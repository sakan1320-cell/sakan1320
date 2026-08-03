CREATE TABLE IF NOT EXISTS public.system_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(255),
    size_bytes BIGINT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Copy existing data from finance_attachments
INSERT INTO public.system_attachments (
    id,
    entity_type,
    entity_id,
    file_path,
    file_name,
    mime_type,
    size_bytes,
    uploaded_by,
    created_at
)
SELECT 
    id,
    'finance_transaction',
    transaction_id,
    file_path,
    file_name,
    mime_type,
    size_bytes,
    uploaded_by,
    created_at
FROM public.finance_attachments;

-- Update RLS policies for system_attachments
ALTER TABLE public.system_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.system_attachments;
CREATE POLICY "Enable read access for authenticated users" 
ON public.system_attachments 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.system_attachments;
CREATE POLICY "Enable insert for authenticated users" 
ON public.system_attachments 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.system_attachments;
CREATE POLICY "Enable delete for authenticated users" 
ON public.system_attachments 
FOR DELETE 
TO authenticated 
USING (true);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_system_attachments_entity ON public.system_attachments(entity_type, entity_id);
