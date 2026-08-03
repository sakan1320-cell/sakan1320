
ALTER TABLE public.participants ALTER COLUMN national_id DROP NOT NULL;
ALTER TABLE public.participants ALTER COLUMN phone DROP NOT NULL;

UPDATE public.participants SET national_id = NULL WHERE national_id = '';
UPDATE public.participants SET phone = NULL WHERE phone = '';
UPDATE public.guardians SET national_id = NULL WHERE national_id = '';
UPDATE public.guardians SET email = NULL WHERE email = '';
UPDATE public.staff_registration_requests SET national_id = NULL WHERE national_id = '';

WITH d AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY national_id ORDER BY created_at ASC) rn FROM public.participants WHERE national_id IS NOT NULL)
DELETE FROM public.participants WHERE id IN (SELECT id FROM d WHERE rn > 1);

WITH d AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY national_id ORDER BY created_at ASC) rn FROM public.guardians WHERE national_id IS NOT NULL)
DELETE FROM public.guardians WHERE id IN (SELECT id FROM d WHERE rn > 1);

WITH d AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY created_at ASC) rn FROM public.guardians WHERE email IS NOT NULL)
DELETE FROM public.guardians WHERE id IN (SELECT id FROM d WHERE rn > 1);

WITH d AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY created_at ASC) rn FROM public.staff_registration_requests)
DELETE FROM public.staff_registration_requests WHERE id IN (SELECT id FROM d WHERE rn > 1);

WITH d AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY national_id ORDER BY created_at ASC) rn FROM public.staff_registration_requests WHERE national_id IS NOT NULL)
DELETE FROM public.staff_registration_requests WHERE id IN (SELECT id FROM d WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS participants_national_id_unique ON public.participants(national_id) WHERE national_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS guardians_national_id_unique ON public.guardians(national_id) WHERE national_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS guardians_email_unique ON public.guardians(lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_req_email_unique ON public.staff_registration_requests(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS staff_req_national_id_unique ON public.staff_registration_requests(national_id) WHERE national_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles(lower(email)) WHERE email IS NOT NULL;
