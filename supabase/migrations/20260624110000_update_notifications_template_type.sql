-- Convert enum column to text to support dynamic template keys
ALTER TABLE notifications ALTER COLUMN template TYPE text USING template::text;
-- (Optional) We can drop the enum type if no longer used elsewhere, but keeping it is fine.
