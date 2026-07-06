
ALTER TABLE public.outbound_queue ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.inbound_messages ADD COLUMN IF NOT EXISTS reply_status text NOT NULL DEFAULT 'pending_review';
ALTER TABLE public.inbound_messages ADD COLUMN IF NOT EXISTS reply_sent_at timestamptz;
ALTER TABLE public.inbound_messages ADD COLUMN IF NOT EXISTS in_reply_to_send_id uuid REFERENCES public.email_sends(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS inbound_user_status_idx ON public.inbound_messages(user_id, reply_status, received_at DESC);
