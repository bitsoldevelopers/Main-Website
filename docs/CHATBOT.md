# Chatbot

The AI assistant that answers on every public page of bitsolmarketing.com (the
floating button, and `/chat`) and, once a number is connected, on WhatsApp. It
is managed from **Admin → Chatbot**. This replaces the old scripted widget that
lived in `public/chatbot/`.

## What it does

- Answers from the **Knowledge Base** (Admin → Chatbot → Knowledge Base), the
  services catalogue and the contact details, voice and published prices in
  **Chatbot Studio**. It never invents prices, clients or guarantees.
- Talks like a representative: asks for a name, a number and what the customer
  needs in conversation, one question at a time. A separate JSON-only model
  call reads the details back out and validates them (a phone number must
  appear in what the customer typed, BITSOL's own contacts are refused).
- Files what it learns into the CRM:
  - a **Lead** under CRM → Leads (source "Website chatbot" or "WhatsApp
    chatbot") with a chat profile: score, temperature, service, budget,
    timeline, intent;
  - a **consultation request** or **support ticket** under Chatbot → Tickets &
    Meetings, each with the reference the customer was shown;
  - on WhatsApp, quote requests become **Tasks** on the lead.
- Hands over to a person when asked, when the customer is upset, or when it
  cannot answer twice in a row. Handovers show as a badge on Conversations.
- Notifies the team by email (Resend) and in the Activity log.

## Admin screens

| Screen | Permission | What it is for |
| --- | --- | --- |
| Conversations | chatbot.view | Every transcript, website and WhatsApp. Reply to a WhatsApp customer as a person, pause the assistant, mark a handover as handled. |
| Tickets & Meetings | chatbot.view / write | Support tickets and consultation requests the assistant raised; update their status. |
| Knowledge Base | chatbot.view / write | Questions and answers the assistant may use. Import the built-in entries, then edit. Only published entries are used. |
| Chatbot Studio | chatbot.manage | 19 sections: contact details, personality, messages, menus, buttons, flows, options, markets, intents, pricing, teams, scoring, enterprise, handover, follow-up, source codes, proof, broadcast categories. Edited as JSON with validation. |
| Simulator | chatbot.manage | Talk to the WhatsApp assistant with the live configuration and model. Nothing is sent or saved; the side panel shows what the team would receive. |
| Chatbot Analytics | chatbot.view | Conversations, leads, outcomes, intents, languages, handovers, per channel and period. |
| Templates | chatbot.manage | The WhatsApp Business Account's message templates, mirrored from Meta. Sync to learn which are approved, submit a new one for review, delete. See *Templates and broadcasts*. |
| Broadcasts | chatbot.manage | Send an approved template to many contacts at once: compose, pick the audience, draft or schedule, then send from the row. Per-recipient delivery and read receipts. |
| Chatbot Setup | chatbot.manage | Which AI provider is in use; **Connect WhatsApp** (the WhatsApp details, the callback URL and verify token for Meta, and the setup checks); the follow-up cron line; recent questions. |

ADMIN has everything; MANAGER and EDITOR have `chatbot.view` and `chatbot.write`.

## Going live

1. **Database.** Apply `docs/sql/2026-10-25-chatbot-update.sql` and then
   `docs/sql/2026-11-15-whatsapp-broadcasts.sql` to the live
   database (phpMyAdmin, or the mysql client over SSH). Migrations never run on
   deploy on Hostinger. Until it is applied the chat still answers, but nothing
   is stored and Admin → Chatbot reports the database unreachable.
2. **AI key.** Set a working `ANTHROPIC_API_KEY` on the server, then open
   Chatbot Setup: the AI provider card asks Claude for a one-word answer and
   says whether the key works. The key in the office PC's `.env` was rejected
   (401) on 25 October 2026. Without a working key the widget asks visitors to
   WhatsApp instead of answering. The Social page's Gemini / Groq /
   OpenRouter keys are not used unless `AI_PROVIDER` lists them (for example
   `claude,gemini` for a fallback): they are reserved for social posts, and
   Gemini's free tier passes conversations to Google.
3. **Knowledge base.** Admin → Chatbot → Knowledge Base → *Import built-in
   entries*, then review. Chatbot Studio → Contact details, Pricing and Teams
   are the sections worth checking first; put the team's inboxes in Teams so
   notifications reach the right people.
4. **WhatsApp (optional).** See *Connecting WhatsApp* below. It is done on the
   live site's admin panel, after this version is deployed.
5. **Follow-ups (optional, WhatsApp only).** Add the cron line shown on Chatbot
   Setup. It reuses `AUTOMATION_CRON_SECRET` unless `CHATBOT_CRON_SECRET` is set.

Environment variables are listed in `.env.example` under *Chatbot*.

## Connecting WhatsApp

Meta calls the live site, and the live site reads its own database, so this is
done on **https://bitsolmarketing.com/admin/chatbot/setup** once this version
is deployed. Nothing needs a redeploy: details saved there are stored encrypted
in `SiteSetting` (`whatsapp.*`, key derived from `ADMIN_SECRET`) and take
effect at once. A value saved on the page wins over a server variable of the
same name; *Remove the details saved here* goes back to the variables.

1. **WhatsApp details.** From Meta for Developers (the app with the WhatsApp
   product): App ID and App secret (App settings → Basic), Phone number ID and
   WhatsApp Business Account ID (WhatsApp → API Setup). From Business Settings
   → Users → System users → Generate new token: a token with expiry *Never* and
   `whatsapp_business_messaging` plus `whatsapp_business_management`. The
   temporary token on API Setup stops working after 24 hours. *Save and check*
   asks Meta about the number and the App ID and secret straight away.
2. **Webhook for Meta.** Press *Generate a verify token*. In Meta: WhatsApp →
   Configuration → Webhook → Edit, paste the callback URL
   `https://bitsolmarketing.com/webhook` and the verify token, press *Verify
   and save*, then subscribe to the `messages` field. Meta uses the verify
   token only while verifying, so replacing it later does not stop messages.
3. **Check the setup.** *Run the checks* reports, with what to do for each:

   | Check | How it is checked |
   | --- | --- |
   | App ID and secret | Meta answers an app token made of the two only when they belong together. |
   | Access token | Meta's `debug_token`: valid, type, expiry, the two permissions, which app made it. |
   | Phone number | The number's display name, status, platform and quality rating. |
   | Callback URL | The callback URL is called exactly as Meta calls it, with this page's verify token. |
   | Signature check | A test delivery signed with this page's app secret must be accepted, a wrongly signed one refused. Only sent once the callback URL check passes. |
   | Verified by Meta | The activity log: Meta's last verification, or a verification that arrived with another token. |
   | Webhook subscription | Which app receives the WhatsApp Business Account's messages, with a *Subscribe this app* button. |
   | Messages arriving | The last inbound message, and deliveries refused for a bad signature in the last 7 days. |
   | Assistant replies | Whether replies are on (the *The assistant replies on WhatsApp* switch). |

   The checks send no message to anyone. Their requests to the callback URL
   carry the `x-bitsol-webhook-self-test` header, which keeps them out of the
   activity log. It changes only what is logged, never what is accepted.

Secrets never go back to the browser: the form shows where each value comes
from and the last four characters of a saved secret. The activity log records
which details changed, never their values.

## Templates and broadcasts

A broadcast is a message to people who did not write to the number in the
last 24 hours, and Meta only allows that through a **message template** it
has reviewed and approved. So the two screens are two halves of one job.

**Templates** (Admin → Chatbot → Templates) mirrors the WhatsApp Business
Account's template list. It needs the account ID and a permanent token with
`whatsapp_business_management`, both entered on Chatbot Setup → Connect
WhatsApp.

- *Sync from Meta* reads every template in the account, with its approval
  status, category, quality rating and rejection reason. Nothing else updates
  the status, so a composer that shows no approved templates usually means
  nobody has synced since the review. A template Meta no longer lists is
  marked disabled, never deleted, so old broadcasts keep their history.
- *New template* submits one for review: name in Meta (lowercase, digits,
  underscores), language, category (utility is cheaper and reviewed more
  leniently than marketing), optional header and footer, the body with
  `{{1}}`, `{{2}}` placeholders, and an example value per placeholder, which
  Meta requires. The verdict arrives on the next sync, in minutes to a day.
- *Delete* removes the template from Meta as well. Meta deletes every
  language variant of the name, which the confirmation says.

**Broadcasts** (Admin → Chatbot → Broadcasts):

1. *New broadcast*: pick an approved template, choose how each placeholder is
   filled (the contact's WhatsApp profile name with a fallback, the same text
   for everyone, or the contact's number), and pick the audience. The preview
   shows what a sample recipient reads. A template with an image, video or
   document header needs a public media URL, because Meta keeps the format
   but not the file.
2. *Audience*: either the contacts this number already knows (optionally only
   those active in the last N days, optionally capped), or a pasted list of
   numbers, one per line or a CSV with a name in the second column. Pasted
   numbers become contacts, so a later STOP from them is honoured. Anyone who
   has opted out or been blocked is always excluded, and the count on screen
   is the count that will be messaged.
3. *Save as draft* builds the recipient list and sends nothing. *Send* on the
   row asks for confirmation with the exact count, then runs in the
   background at four messages a second; the page refreshes itself while it
   runs. A run cut short by a redeploy is resumed with *Retry*: recipients
   already messaged are skipped.
4. Optionally *Send at* a later time. A scheduled broadcast goes out on the
   next run of the follow-up cron after that time, so the cron line from
   Chatbot Setup must be installed on the server.

The webhook matches Meta's delivery and read receipts to recipients, so each
broadcast shows targeted, accepted by Meta, delivered, read and failed, and
the detail page shows every recipient with Meta's reason for a failure.
Meta charges per conversation a broadcast opens, and a burst to stale numbers
lowers the number's quality rating, which is why the activity filter exists.

## How the AI is called

- Claude `claude-opus-5-5` at **low effort** for replies (a live chat wants a
  quick answer; raise `AI_EFFORT` if answers need more care). The same model
  reads each turn for the customer's details unless `AI_EXTRACTION_MODEL`
  names a cheaper one such as `claude-haiku-5-5`.
- **Refusal fallback is on:** if Claude's safety classifiers decline a request
  (cyber security and penetration testing are on the service list, which is
  where false positives happen), Anthropic re-runs it on its recommended model
  for that category, on the same stream (`fallbacks: "default"`, beta
  `server-side-fallback-2026-07-01`). Turn it off with
  `AI_REFUSAL_FALLBACK=off`. A refusal that still ends the turn shows the
  visitor the friendly apology, and the partial reply is not stored.
- `AI_PROVIDER=claude,gemini` (any order, any of claude / gemini / openai /
  ollama) makes the next provider answer when the first fails before writing a
  word — a bad key, an outage, a quota. A failed provider is skipped for a
  while afterwards so visitors do not wait on the same error.

## Tests

```bash
npm test                     # engine, scoring, detection, the Claude provider, WhatsApp settings, webhook, setup checks, number lists, templates and broadcasts (no network)
DATABASE_URL=mysql://root@localhost:3306/bitsol_next npm run test:integration
```

The integration test (`src/lib/chatbot/__tests__/chat-route.integration.ts`)
drives `/api/chat` against the local database with a mock AI server: reply
stream, stored transcript, lead and chat profile, consultation, ticket and
handover, a knowledge entry edited in the panel, the provider fallback and the
no-key message. It refuses to run against anything but localhost and removes
what it creates.

## Where things live

```
src/app/api/chat/route.ts                 website chat (SSE) → persistence → CRM capture
src/app/api/whatsapp/webhook/route.ts     Meta webhook (/webhook is rewritten here)
src/app/api/cron/follow-ups/route.ts      WhatsApp follow-up scheduler
src/app/api/admin/chatbot/*               Studio save/reset, simulator, conversation reply/pause
src/app/admin/(panel)/chatbot/*           the admin screens
src/app/admin/actions-chatbot.ts          knowledge base, tickets & meetings, conversation actions
src/app/admin/actions-whatsapp.ts         WhatsApp details, verify token, setup checks, webhook subscription
src/app/admin/actions-broadcasts.ts       template sync/submit/delete, audience counts, broadcast create/send/unschedule/delete
src/components/admin/chatbot/WhatsAppSetup.tsx  the Connect WhatsApp section of Chatbot Setup
src/components/admin/chatbot/Template*.tsx, Broadcast*.tsx  the interactive parts of the Templates and Broadcasts screens
src/components/chat/ChatPanel.tsx         the chat surface (widget and /chat page)
src/components/ChatWidget.tsx             the floating button
src/lib/ai/*                              providers (Claude, Gemini, OpenAI-compatible) and fallback chain, prompt, knowledge retrieval, details extraction, the Setup page's live key check
src/lib/bot/*                             the WhatsApp conversation engine, schema, config, scoring, analytics, follow-ups
src/lib/capture.ts                        conversation details → Lead / ChatRequest
src/lib/whatsapp/*                        Cloud API client, webhook parsing, inbound handler, settings (panel or environment), setup checks, templates (Meta sync), broadcasts (audience, send loop, receipts), number lists
src/data/marketing/*                      built-in knowledge base, services catalogue, Chatbot Studio defaults
src/lib/bot/__tests__/*                   engine tests (npm test), no network or database
```

Tables: `ChatConversation`, `ChatMessage`, `ChatEvent`, `ChatKnowledge`,
`ChatbotSetting`, `ChatLeadProfile`, `ChatRequest`, `WhatsappContact`,
`WhatsappTemplate`, `Broadcast`, `BroadcastRecipient`.

## Not brought over

The standalone chatbot app also had quotations, customers, projects,
portfolio, events and its own users and roles. Those are not part of this
module: the website's own CRM, users and content screens cover the
equivalents. Its template management and broadcasts were brought over on
15 November 2026 (see *Templates and broadcasts*).
