# Lead automation

Import leads from Google Sheets or a CSV, de-duplicate them into the CRM, and
run email sequences that stop the moment a lead replies. Lives in the admin
under **CRM → Lead Automation** (`/admin/automation`).

```
Source (Google Sheets, CSV, website form, manual)
  → normalise → validate → duplicate check → create / update lead
  → choose outreach email → assign → tag → start automation
  → email 1 → wait → reply? stop : follow-up → … → human task
```

## Going live, in order

Nothing is sent until steps 1–4 are done. Admin → Lead Automation → Settings
shows the state of each.

1. **Database, then deploy.** The migrations have to be applied to the live
   database by hand: Hostinger starts the app from `server.js`, not
   `npm start`, so `prisma migrate deploy` never runs there. Import
   [`docs/sql/2026-09-29-database-update.sql`](sql/2026-09-29-database-update.sql)
   in phpMyAdmin (export a backup first; the steps are at the top of the
   file). It only adds tables and columns. To check the result, open
   `https://bitsolmarketing.com/blog-images/x`: *Not found* means the tables
   are there, *Image unavailable* means they are not.
2. **Email provider.** `RESEND_API_KEY` is already set for lead notifications.
   In Resend, verify the domain outreach is sent from. A separate sending
   subdomain (for example `outreach.bitsolmarketing.com`) keeps cold outreach
   from affecting the reputation of the main domain.
3. **Sender.** Settings → Sender: name, address, reply-to, postal address,
   daily limit. Start with a low limit on a new domain.
4. **Activate the automation.** Automations → *BITSOL Cold Outreach* is
   created as a draft. Read its four emails under Templates, edit them, then
   Activate.
5. **Google Sheets** (optional; CSV upload works without it). In Google Cloud
   Console create an OAuth client of type *Web application*, enable the
   *Google Sheets API* and the *Google Drive API*, and add the redirect URI
   `https://bitsolmarketing.com/api/admin/google/callback`. Set
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, redeploy, then Sources →
   Google Sheets → Connect.
   Publish the OAuth consent screen ("In production"). While it is in
   "Testing", Google expires the authorisation after 7 days and the account
   has to be reconnected.
6. **Tracking** (recommended). In Resend → Webhooks add
   `https://bitsolmarketing.com/api/webhooks/resend` for the `email.*` events
   and set its signing secret as `RESEND_WEBHOOK_SECRET`. Without it bounces,
   opens and replies are not detected. For automatic reply detection also set
   up Resend Inbound on the reply-to address; otherwise use **Mark as replied**
   on the lead.
7. **Cron** (recommended). Set `AUTOMATION_CRON_SECRET` and add a cron job in
   hPanel, every minute:
   `curl -fsS -H "Authorization: Bearer <secret>" https://bitsolmarketing.com/api/automation/cron`
   The app also runs the queue itself once a minute, but only while the Node
   process is up.

## Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `RESEND_API_KEY` | Sending | Already in use |
| `AUTOMATION_SECRET` | Encryption, unsubscribe links | Falls back to `ADMIN_SECRET`. Set it, and never change it: changing it breaks unsubscribe links in emails already sent and the stored Google tokens |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Sheets | |
| `GOOGLE_REDIRECT_URI` | — | Only if the redirect URI must differ |
| `RESEND_WEBHOOK_SECRET` | Bounces, opens, replies | Endpoint is off (404) without it |
| `AUTOMATION_CRON_SECRET` | Cron endpoint | Endpoint is off (404) without it |
| `OUTREACH_EMAIL_MODE=test` | Rehearsal | Records every email, delivers none |
| `AUTOMATION_SCHEDULER=off` | — | Cron only |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` | AI Personalize | Optional |

## What the system guarantees

- **One address per lead.** Email 1, then Email 2, then Personal Email;
  invalid, bounced, unsubscribed and suppressed addresses are skipped. The
  three addresses are stored separately and never overwrite each other.
- **Stop conditions are checked twice:** when they happen, and again before
  every send. Reply, won, lost, not interested, unsubscribe, bounce, pause,
  and any status that means a person has taken over.
- **An unsubscribe is permanent** and covers all of that person's addresses.
  It cannot be removed from the suppression list in the admin.
- **Every email has an unsubscribe link and the postal address.** Opening the
  link does nothing; the button on the page does.
- **No duplicates from formatting.** Matching ignores case, spacing, phone
  formatting, `www.` and URL parameters. Shared mailboxes (`info@…`) and a
  shared phone line with two different names never merge two people.
- **A sheet never deletes or blanks CRM data.** Empty cells are ignored and
  rows removed from the sheet leave their leads alone.
- **Nothing is invented.** Templates print CRM values only. An AI draft is a
  suggestion that a person reads, edits and saves.

## Where things are

| | |
|---|---|
| `src/lib/automation/` | The library: normalise, validate, import pipeline, engine, queue, Google client |
| `src/lib/automation/sources/` | Source adapters. A new source only has to produce a header row and rows |
| `src/lib/automation/email/` | Provider interface (Resend), template rendering, event handling |
| `src/app/admin/(panel)/automation/` | Admin pages |
| `src/app/admin/actions-{automation,import,leads}.ts` | Server actions |
| `src/app/api/admin/{google,automation,leads}/` | Admin endpoints |
| `src/app/api/{automation/cron,webhooks/resend,unsubscribe}/` | Public endpoints |
| `src/instrumentation.ts` | Starts the in-process scheduler |

## Tests

```
npm test                       # unit tests, no database
DATABASE_URL=mysql://root@localhost:3306/bitsol_next npm run test:integration
```

The integration tests write to the database and refuse to run unless
`DATABASE_URL` points at localhost. They run in test email mode.

## Writing a migration on Windows

`prisma migrate dev` and `migrate diff` report existing tables in lower case
on Windows MySQL and then propose to drop and recreate them. Do not apply
that output. Write `ALTER TABLE` by hand with the table name as the init
migration created it (`Lead`, not `lead`): production MySQL runs on Linux,
where the two are different tables.
