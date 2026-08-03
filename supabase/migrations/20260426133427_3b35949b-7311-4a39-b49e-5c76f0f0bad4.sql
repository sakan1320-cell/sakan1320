-- Add guardian fields directly into participants
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_national_id text,
  ADD COLUMN IF NOT EXISTS guardian_relation guardian_relation,
  ADD COLUMN IF NOT EXISTS guardian_notes text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Backfill from old guardians link if present
UPDATE public.participants p
SET guardian_name = g.full_name,
    guardian_phone = g.phone,
    guardian_email = g.email,
    guardian_national_id = g.national_id,
    guardian_relation = g.relation,
    guardian_notes = g.notes
FROM public.guardians g
WHERE p.guardian_id = g.id
  AND p.guardian_name IS NULL;

-- Make phone and national_id required for new rows (existing nulls allowed via NOT VALID-style approach: use defaults only if non-null exists)
-- We can't force NOT NULL on existing nulls without backfill. Set defaults to empty string and then enforce check.
UPDATE public.participants SET phone = '' WHERE phone IS NULL;
UPDATE public.participants SET national_id = '' WHERE national_id IS NULL;

ALTER TABLE public.participants
  ALTER COLUMN phone SET NOT NULL,
  ALTER COLUMN national_id SET NOT NULL;

-- Unique national_id (only when not empty)
CREATE UNIQUE INDEX IF NOT EXISTS participants_national_id_unique
  ON public.participants (national_id) WHERE national_id <> '';
