# WhatsApp Reminders — Plan (Phase 1 live, Phase 2 future)

**Date:** 2026-06-18 · **Status:** Phase 1 SHIPPED. Phase 2 deferred (needs business registration).

## Context
TREVIS currently cannot register for the Meta WhatsApp Cloud API — that requires a
Meta Business Account + Facebook Page + WhatsApp Business Account + business
registration documents (company reg, utility bill/bank statement) + Meta business
verification. Until the business has those, fully-automatic WhatsApp delivery isn't
possible. So we ship the zero-cost, zero-approval MVP now.

---

## ✅ Phase 1 — Click-to-send (LIVE)

The daily owner email (sent 07:00 CAT by the `Daily Owner Report` GitHub Action)
now contains a green **"💬 Send this summary on WhatsApp"** button.

Flow:
1. Owner gets the 7 AM email (portfolio health, overdue, expiring).
2. Taps the WhatsApp button in the email.
3. WhatsApp opens with the summary **pre-filled** (to `OWNER_WHATSAPP` if set, else
   a chat picker).
4. Owner presses send (to self, a manager, a group, anyone).

- **Cost:** $0. **Meta approval:** none. **Works today.**
- Implemented in `scripts/daily_owner_report.mjs` (`wa.me` deep link with the
  URL-encoded summary). Also printed in the Action run log.

This is the MVP and it's enough for an owner-intelligence workflow: the report is
automatic; the one tap to forward it is trivial.

---

## ⏳ Phase 2 — Meta WhatsApp Cloud API (fully automatic, future)

When the business can register, upgrade to hands-off delivery (no tap):

**Prerequisites (client provides):**
- Meta Business Account + Facebook Page + WhatsApp Business Account
- Business registration documents, utility bill/bank statement
- Meta business verification (approval at "the speed of bureaucracy")

**Then (engineering, ~1 day once approved):**
- Register a sender phone number; get a permanent access token + phone number ID.
- Create + submit a message **template** for approval (required for business-initiated
  messages outside the 24h window).
- Add a `sendWhatsApp()` to `daily_owner_report.mjs` that POSTs to the Cloud API
  (`graph.facebook.com/.../messages`) using the template.
- Store `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` as GitHub secrets; the existing
  scheduled Action then sends automatically.
- Free tier: 1,000 conversations/month, then paid.

**Migration is additive:** Phase 1's click-to-send stays as a fallback; Phase 2 just
adds an automatic send. No rework.

---

## Alternative if Meta is never an option
- **Twilio WhatsApp API** — also needs a sender + template approval, ~\$0.005/msg.
  Same `sendWhatsApp()` shape, different endpoint/creds. Documented here as a fallback.
- **Telegram Bot API** — fully free + automatic, no business verification. If the
  owner is open to Telegram instead of WhatsApp for the *internal* daily report, this
  is the cheapest true-autopilot option (a bot token + chat ID, no approvals).
