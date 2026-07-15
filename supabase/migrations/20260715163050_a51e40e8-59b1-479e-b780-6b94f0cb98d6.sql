ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS product_capabilities text,
  ADD COLUMN IF NOT EXISTS default_email_goal text DEFAULT 'book_meeting';