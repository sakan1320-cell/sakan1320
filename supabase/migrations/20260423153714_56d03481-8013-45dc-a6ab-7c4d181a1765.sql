-- Add new enum values to notification_status
ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'read';
ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'undelivered';

-- Add delivered_at / read_at columns
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- Helpful index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_notifications_provider_message_id
  ON public.notifications(provider_message_id);