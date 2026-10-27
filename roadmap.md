# Roadmap

## Signature logo upload
- [ ] Fix workspace-scoped logo upload permissions and verify upload, preview, and saved design.

## Email sender setup (Resend — outreach.maindesk.io)
- [x] Subdomain added and verified in Resend
- [x] Reply webhook adapter for Resend `email.received` events (fetches body via Resend API)
- [x] Svix signature verification on the inbound webhook (RESEND_WEBHOOK_SIGNING_SECRET)
- [x] Publish with renamed URL pixel-outreach.lovable.app
- [ ] User: enable Receiving in Resend (add the shown MX record at DNS provider)
- [ ] User: create Resend webhook `email.received` → /api/public/webhooks/inbound-email and save its signing secret (RESEND_WEBHOOK_SIGNING_SECRET)
- [ ] User: set from address on outreach.maindesk.io in Settings → Email Sender; run domain health check
- [ ] Test end to end: test email → reply → lands in Inbox with AI classification

## Later / optional
- [ ] Real card payments for paid plans (not confirmed yet)
- [ ] Main-site subscription update link for Won-stage board automation
