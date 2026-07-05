# AI Outbound Agent — Thin MVP Plan

A single-user tool that goes end-to-end: define your business → AI finds coaches/consultants via Firecrawl → AI enriches + detects pain points → AI drafts personalized emails → you approve → Lovable Emails sends → basic inbox + analytics.

## Prerequisites (auto-enabled)

- Lovable Cloud (database, auth, server functions)
- Lovable AI Gateway (already available via `LOVABLE_API_KEY`)
- Firecrawl connector (you'll be prompted to connect once)
- Lovable Emails + email domain (you'll be prompted to set up the sending domain)
- Single-user auth: simple email/password login so your data is protected

## Screens

1. **Onboarding / My Business** — enter your website URL + offer description; AI scrapes and summarizes it into a "business profile" used for all personalization.
2. **Targeting** — pick coach/consultant niches (business, life, fitness, marketing, ops…), locations, keywords. Save as a "search config".
3. **Leads** — table of discovered leads with status (new / enriched / drafted / approved / sent / replied). Row click → detail drawer with business summary, offer, detected pain points, and draft email(s).
4. **Approval Queue** — the core screen. Card per pending email showing lead context + editable email + subject. Approve / Edit / Regenerate / Reject. Bulk approve.
5. **Campaigns** — one default sequence (initial + up to 4 follow-ups, day offsets). Assign leads. Daily send cap slider.
6. **Inbox** — replies grouped by lead. AI classifies (interested / question / objection / not interested) and suggests a reply you can send.
7. **Analytics** — sent, delivered, reply rate, positive reply rate, conversations started.

## Backend (TanStack server functions + one cron route)

- **Business profile**: `analyzeBusiness` server fn → Firecrawl scrape user site → Gemini summary → stored in `business_profile`.
- **Lead discovery**: `discoverLeads` server fn → Firecrawl search on niche queries → dedupe by domain → insert into `leads`.
- **Enrichment + pain points**: `enrichLead` server fn → Firecrawl scrape lead site → Gemini structured output (audience, offer, pricing signals, funnel presence, pain points).
- **Email drafting**: `draftEmails` server fn → Gemini generates initial + follow-ups using business profile + lead context; stored in `email_drafts` (status=pending_approval).
- **Approval actions**: approve / edit / regenerate / reject server fns.
- **Sending**: approved drafts go into an outbound queue with `scheduled_at` respecting the daily cap. Cron route (`/api/public/cron/send-outbound`, HMAC-verified) runs every few minutes, pulls due items, sends via Lovable Emails, records `email_sends`.
- **Follow-ups**: after each send, next step scheduled at offset; if a reply is detected, sequence halts.
- **Inbox / replies**: inbound webhook route (`/api/public/webhooks/inbound-email`) receives replies, matches to lead by message-id/thread, stores in `messages`, runs Gemini classifier + suggested reply.

## Data model (Postgres via Lovable Cloud, RLS scoped to your user)

`business_profile`, `search_configs`, `leads`, `lead_enrichments`, `pain_points`, `campaigns`, `sequence_steps`, `email_drafts`, `outbound_queue`, `email_sends`, `messages`, `send_settings` (daily cap, ramp-up).

## AI usage

- Model: `google/gemini-3-flash-preview` via AI SDK + Lovable Gateway helper (server-only). Structured output via `Output.object` for enrichment, pain points, and reply classification. Plain text for email bodies.

## Explicitly out of scope for v1

LinkedIn, multi-channel, team/multi-tenant, advanced analytics, A/B testing, complex deliverability tooling (SPF/DKIM handled by Lovable Emails setup only).

## Suggested build order (each shippable)

1. Auth + shell + My Business (analyze site).
2. Targeting + lead discovery via Firecrawl.
3. Enrichment + pain points.
4. Email drafting + approval queue.
5. Sending queue + cron + follow-ups.
6. Inbox + reply classifier.
7. Analytics dashboard.

Approve this and I'll start with steps 1–2 (auth, business profile, targeting, lead discovery) in the first build pass.
