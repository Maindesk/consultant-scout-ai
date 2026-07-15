# Maindesk / Platform API integration — build plan

Goal: turn the outreach tool into a resellable multi-tenant product that plugs into any Simvoly white-label (Maindesk first), auto-provisions personalized demo sites for hot leads, and closes the loop when leads subscribe.

Delivered in 3 phases, in the order you chose.

---

## Phase 1 — Multi-tenant workspaces (foundation)

New tables:
- `workspaces` — name, slug, owner, `platform_wl_domain`, `platform_client_key_ciphertext`, `main_site_domain`, `main_site_api_key_ciphertext`, timestamps.
- `workspace_members` — workspace_id, user_id, role (`owner`/`admin`/`member`), unique(workspace_id,user_id).
- `has_workspace_role(_user, _workspace, _role)` SECURITY DEFINER helper (same pattern as user_roles guidance).
- Add nullable `workspace_id` to every existing user-scoped table (`business_profiles`, `business_sources`, `leads`, `lead_enrichments`, `email_drafts`, `outbound_queue`, `email_sends`, `inbound_messages`, `search_configs`, `automation_settings`) with FK + index.
- Migration backfill: for each existing user, create a personal workspace and stamp their rows.
- RLS: rewrite policies to use `has_workspace_role(auth.uid(), workspace_id, 'member')` instead of `user_id = auth.uid()`. Keep `user_id` for audit.

Server-side crypto:
- New `src/lib/workspace-crypto.server.ts` — AES-256-GCM using `APP_USER_CONNECTION_KEY_SECRET` (auto-provisioned) to encrypt both keys. Never returned to browser.
- New `src/lib/workspace.functions.ts` — `getMyWorkspaces`, `createWorkspace`, `setActiveWorkspace` (stores in profile / cookie), `updateWorkspaceKeys` (accepts plaintext, encrypts before insert; returns only booleans indicating presence, never the key).

UI:
- Workspace switcher in the sidebar header (`_authenticated/route.tsx`).
- New page **Settings → Workspace** (`_authenticated/settings.tsx`) with:
  - Workspace name.
  - **Platform API** section: WL domain (e.g. `maindesk.io`) + Platform X-CLIENT-KEY (password field, masked once saved, "Replace key" button).
  - **Main Site API** section: main site domain + Website API key.
  - Test buttons that ping `GET /api/v1/plans` and `GET /api/site/contacts?limit=1` respectively and show ✓ / error.
- All existing screens read/write against the active workspace_id.

---

## Phase 2 — Auto-provision demo site + SSO on hot leads

New helper: `src/lib/platform-api.server.ts` — thin typed client for the Platform API. Reads the current workspace's decrypted client key + WL domain per call. Exposes:
- `createProjectWithWebsite({ workspaceId, lead, templateId?, funnelTemplateId? })`
- `assignCustomer(...)`, `createSsoSession(...)`, `listWebsiteTemplates()`, `listFunnelTemplates()`, `getPlans()`.

New table `lead_platform_sites`:
- lead_id (unique), workspace_id, project_id, website_id, subdomain, template_id, template_type, personalization_tags jsonb, edit_sso_url (nullable — short-lived, refreshed on demand), sso_expires_at, created_at.

New server fns (`src/lib/platform.functions.ts`):
- `provisionDemoSiteForLead(lead_id, templateId?)` — pulls lead + enrichment, extracts brand color from scraped HTML (already stored in `website_signals`), builds `personalizationTags` from business_name / offer / audience, POSTs to `/api/v1/website` using `externalCustomerId = lead.id`, stores result in `lead_platform_sites`, returns subdomain.
- `getFreshEditLink(lead_id)` — always mints a fresh SSO session (15-min expiry) and returns the `accessUrl`.
- `listAvailableTemplates()` — cached list for the picker.

Automation hooks (opt-in per workspace via new toggle `automation_settings.auto_provision_on_reply`):
- On inbound reply classified as `interested`, and on AI stage move to `in_progress`, auto-run `provisionDemoSiteForLead` if none exists.
- Draft/regenerate follow-up email #3 to include the fresh edit link.

UI:
- **Lead drawer** (`_authenticated/leads.tsx`): new "Demo site" panel — Provision button with template dropdown, subdomain preview, "Open live preview" and "Get 1-click edit link" (copies fresh SSO URL, warns 15-min expiry).
- **Board card**: badge "Demo site ready" when provisioned.
- **My Business**: optional default template id per niche.

---

## Phase 3 — Platform webhooks → close the loop

New route `src/routes/api/public/webhooks.platform.ts` (POST):
- Verifies `X-Webhook-Signature` HMAC-SHA512 against a per-workspace signing secret stored in `workspaces.webhook_secret_ciphertext`.
- Resolves workspace by matching `project.id` → `lead_platform_sites.project_id`.
- Handles topics:
  - `subscription_activated` → move lead to `won`, write real MRR into new `leads.won_mrr` / `won_period` / `won_at`, insert into new `revenue_events` table (`type='activation'`, amount, period, plan_id, plan_name).
  - `subscription_renewed` → insert `revenue_events` row (`type='renewal'`).
  - `subscription_expired` / `trial_expired` → move lead to `lost` with `ai_stage_reason='subscription_expired'`.
  - `user_created` / `project_created` — informational log into `platform_events`.
- All ignored payloads still logged for debugging.

Analytics:
- Update `/analytics` page: real MRR from `revenue_events`, LTV placeholder, conversion rate (leads → won), average time-to-close.
- Board expected value continues to use `avg_deal_value` for open stages; won stage now shows actual `won_mrr`.

Settings additions in Phase-3:
- Webhook URL + signing secret shown in **Settings → Workspace → Platform** with copy button and setup instructions for the WL admin panel.

---

## Cross-cutting

- Same encryption helper covers all secrets (Platform key, Website key, webhook signing secret).
- Every new server fn is `requireSupabaseAuth` + `has_workspace_role` check.
- `src/lib/autopilot.server.ts` already loops per user — will loop per workspace member's active workspace instead.
- No changes to Firecrawl / AI / email pipelines beyond passing `workspace_id` through.

## Out of scope for this plan (call out later if wanted)

- Billing/paywall for the outreach tool itself (Stripe metering per workspace).
- Public marketplace of ready templates matched to niches.
- Per-workspace custom SMTP for Lovable Emails.

---

## Technical notes

- Uses existing patterns: `createServerFn` + `requireSupabaseAuth`; `supabaseAdmin` loaded inside handlers only.
- All Platform API calls use `application/x-www-form-urlencoded`, `X-CLIENT-KEY` header, per docs.
- SSO uses the recommended `POST /api/platform/session` (not deprecated `/api/v1/build`).
- Webhook route lives under `/api/public/*` (auth-bypassed on publish); signature verification is the only trust boundary.
- Migration ordering: create workspace tables → backfill → add workspace_id to existing tables (nullable) → backfill → set NOT NULL → drop `user_id`-based RLS and replace.

## Approval

Approve to start Phase 1 (workspaces + settings UI + migrations). Phases 2 and 3 land in follow-up migrations so each phase ships independently.
