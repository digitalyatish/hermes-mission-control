# HERMES MISSION CONTROL — Project Brain

## WHAT THIS IS
A command center web app that visualizes and controls a Hermes Agent system. Three integrated tools:
1. **Meeting Intelligence** — 111+ meetings from Fathom with transcripts, AI summaries, action items, feedback loop, and search across all transcripts
2. **Outreach Autopilot** — ICPs, lead scraping via Apify, CSV import, multi-step email campaigns via Resend, nurture sequences triggered by Cal.com bookings, A/B testing, agent-optimized copy
3. **Custom Dashboard** — unified view with calendar, AI activity log, agent memory, skills + skill builder, webhooks/functions system, and full API integration guide

## AI-FIRST PRINCIPLE
Every feature MUST be usable by both humans (via UI) and AI agents (via API). When building any new feature:
1. Build the UI component
2. Add the corresponding API action in `hermes-api` Edge Function
3. Document it in `src/pages/Integrations.jsx` API reference

The `hermes-api` Edge Function at `/functions/v1/hermes-api` is the single API endpoint. All actions use POST with `{ action: "resource.verb", params: {...} }` and `X-API-Key` auth. See `src/pages/Integrations.jsx` for the full catalog (109 endpoints, 19 groups).

## TECH STACK
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4 + Framer Motion + Recharts + Lucide React + React Markdown
- **Backend:** Supabase (PostgreSQL + Edge Functions), project ID: `smmquuwzdininxleloom`
- **APIs:** Fathom (meetings), Resend (email), Apify (lead scraping), Cal.com (bookings)
- **AI Agent:** Hermes Agent (autonomous, creates skills, learns over time)
- **Node:** `/opt/homebrew/bin/node` v25 — always `export PATH="/opt/homebrew/bin:$PATH"` before npm/npx

## SUPABASE PROJECT
- URL: `https://smmquuwzdininxleloom.supabase.co`
- Edge Functions base: `https://smmquuwzdininxleloom.supabase.co/functions/v1/`
- Deploy: `supabase functions deploy <name> --no-verify-jwt`
- Secrets set via: `supabase secrets set KEY=value`

## EMAIL SENDING
- All outreach/campaign/notification emails: `Mani Kanasani <mani@updates.growthcreators.ai>`
- Reply-to: `mani@growthcreators.ai`
- NEVER use "Hermes Mission Control" as a sender name
- All campaign emails auto-include unsubscribe footer

## EDGE FUNCTIONS (8 deployed)
| Function | Purpose |
|----------|---------|
| `hermes-api` | Single API gateway — 109 actions across 19 groups |
| `fathom-webhook` | Receives Fathom meeting data, verifies HMAC, upserts to fathom_meetings, auto-tags `needs_analysis` |
| `register-fathom-webhook` | Server-side proxy to register webhooks with Fathom API (keeps API key secure) |
| `resend-webhook` | Handles Resend email events (opens, clicks, bounces), updates campaign + nurture tracking |
| `cal-webhook` | Handles Cal.com BOOKING_CREATED/RESCHEDULED/CANCELLED, auto-creates nurture sequences |
| `nurture-sender` | Cron-triggered, sends scheduled nurture emails via Resend with default or AI-personalized templates |
| `lead-magnet` | Serves hosted lead magnets as branded HTML pages with CTA |
| `unsubscribe` | Handles email unsubscribe requests, marks lead as do_not_contact |

## DATABASE (25 tables)

### Meeting Intelligence
- `fathom_meetings` — id, title, meeting_date, duration_minutes, company_name, company_domain, meeting_type, attendees (JSONB), transcript (JSONB), transcript_text, summary_markdown, action_items (JSONB), custom_notes, proposal_draft, custom_action_items (JSONB), hermes_insights (JSONB), tags (TEXT[])
- `meeting_feedback` — id, meeting_id, source (user/agent), feedback_type (rating/correction/context/note/action_request), content, metadata (JSONB), is_read

### Webhooks & Functions
- `webhooks` — id, name, service, endpoint_url, webhook_secret, config (JSONB), status, callback_url, event_count
- `webhook_events` — id, webhook_id, event_type, payload (JSONB), headers (JSONB), status
- `webhook_functions` — id, webhook_id, name, prompt (TEXT), is_active, execution_order

### Agent Skills & Learning
- `agent_skills` — id, name (UNIQUE), category, version, description, tags (TEXT[]), trigger_pattern, source (builtin/custom/learned), content_hash, skill_metadata (JSONB)
- `skill_changelog` — id, skill_id, change_type (created/patched/major_update/deprecated), change_summary, triggered_by, meeting_id
- `skill_submissions` — id, input_type, input_url, input_text, extracted_content, processing_status
- `skill_proposals` — id, submission_id, skill_name, skill_content, status (pending/approved/rejected/edited)

### Agent Memory
- `agent_memory` — id, memory_type (memory/user), content, is_active, replaced_by
- `memory_daily_logs` — id, log_date (UNIQUE), summary, decisions_made, things_learned, context_notes, active_projects, blocked_items, metrics (JSONB), sync_count
- `memory_snapshots` — id, snapshot_type, title, persistent_memory, session_summary, key_context, cron_state (JSONB)

### Outreach
- `icps` — id, name, industry_verticals (TEXT[]), geographies (TEXT[]), job_titles (TEXT[]), pain_points (TEXT[])
- `leads` — id, email (UNIQUE), first_name, last_name, company_name, job_title, website, source, icp_id, status, tags (TEXT[]), custom_data (JSONB), enrichment_data (JSONB), do_not_contact
- `campaigns` — id, name, icp_id, status (draft/ai_processing/ready_for_review/active/paused/completed), ai_level (none/full/lead_magnet), templates (JSONB), sequence_steps, from_name, from_email, total_sent/opened/clicked/replied/bounced
- `campaign_leads` — id, campaign_id, lead_id, current_step, status, personalization (JSONB)
- `email_sends` — id, campaign_id, lead_id, resend_id, subject, body_html, status, opened_at, clicked_at
- `email_events` — id, resend_id, email_send_id, event_type, event_data (JSONB)
- `outreach_insights` — id, campaign_id, insight_type, finding, action_taken, confidence
- `scraper_runs` — id, scraper_type, query, status, results_count, leads_created
- `lead_magnets` — id, lead_id, campaign_id, title, content_html, hosted_url, view_count

### Nurture
- `nurture_sequences` — id, lead_id, booking_uid (UNIQUE), meeting_time, prospect_name, prospect_email, status, emails_sent/planned
- `nurture_emails` — id, sequence_id, email_type (welcome/value_1/value_2/value_3/reminder_24h/reminder_1h), scheduled_at, status, resend_id

### System
- `agent_activity_log` — id, activity_type, source, summary, details (JSONB), status, duration_seconds
- `calendar_cache` — id, source, event_id (UNIQUE with source), title, start_time, end_time, color, event_type

## UI PAGES (12 routes)
| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Meeting stats, charts, recent meetings, top companies, agent activity panel |
| `/calendar` | Calendar | Week view merging Google Calendar, nurture calls, campaign windows |
| `/meetings` | Meetings | Searchable list of 111+ meetings with type/tag filters |
| `/meetings/:id` | MeetingDetail | 8-section scrollable page: summary, actions, notes, proposal, custom tasks, Hermes insights, feedback, transcript |
| `/outreach` | Outreach | 6 tabs: Dashboard, Campaigns, Nurture, Leads, ICPs, Insights |
| `/outreach/campaign/:id` | CampaignDetail | Campaign stats, leads table, email sends, approve/launch/pause |
| `/webhooks` | Webhooks | Register/manage webhooks (Fathom, Resend, Cal.com, custom) |
| `/webhooks/:id` | WebhookDetail | Webhook config, functions management, event audit log |
| `/skills` | Skills | 3 tabs: All Skills grid, Changelog feed, Skill Builder |
| `/memory` | Memory | 3 tabs: Persistent Memory (editable), Daily Logs, Snapshots |
| `/ai-log` | AILog | Full agent activity monitor with cron status grid, error panel, timeline |
| `/integrations` | Integrations | API reference with "Copy Full Docs" button for agents |

## DESIGN SYSTEM
- Background: `#0A0A0F` with radial gradient (cyan top-left, purple bottom-right) + 48px grid overlay
- Primary: `#00BFFF`, Accent: `#FF6B35`, Success: `#00E676`, Purple: `#A855F7`, Amber: `#F59E0B`
- Fonts: Orbitron (headings), Rajdhani (body), JetBrains Mono (data/mono)
- Glass cards: `bg-white/[0.02] backdrop-blur-20 border-white/[0.08] rounded-xl` with inset shadow
- App shell: 24px outer padding, rounded 2xl container with border, AI Status Bar at top
- Sidebar: 280px, centered logo with pulsing glow, 52px nav items with gradient active state
- Stat numbers: 64px Orbitron bold with text-shadow glow
- Page headers: text-5xl with 2px gradient underline accent

## GOTCHAS & PATTERNS
- `* { padding: 0 }` CSS reset overrides Tailwind v4 `p-6` — use `:where()` scoping in reset
- Supabase JSONB can be double-encoded (string inside JSONB) — always use `safeParseJson` with recursive unwrap
- React Router v7: `NavLink` children render function crashes silently — use `className` function only, regular children
- Fathom `action_items[].assignee` is an object `{name, email, team}`, not a string — render `assignee.name`
- Supabase query builder has no `.catch()` — always use `const { error } = await` destructuring
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` (auto-available) — bypasses RLS
- `npm`/`node` at `/opt/homebrew/bin/` — not in default PATH
- Apify scraper: `compass~crawler-google-places`, costs ~$0.0002 per 5 leads
- Nurture email schedule auto-calculates based on hours until meeting (2-6 emails)
- All new meetings from Fathom webhook auto-tagged `needs_analysis`
- Feedback on meetings auto-tags `has_feedback`

## FILE STRUCTURE
```
hermes-mission-control/
├── CLAUDE.md
├── .env.local (API keys — gitignored)
├── src/
│   ├── App.jsx (routes + ErrorBoundary + AIStatusBar)
│   ├── main.jsx (React entry)
│   ├── app.css (Tailwind + glass + prose-hermes + grid-bg)
│   ├── lib/
│   │   ├── supabase.js (Supabase client)
│   │   └── webhooks.js (webhook/function CRUD helpers)
│   ├── components/
│   │   ├── Sidebar.jsx, MetricCard.jsx, ErrorBoundary.jsx
│   │   ├── AIStatusBar.jsx, ActivityPanel.jsx
│   │   ├── MeetingFeedback.jsx
│   │   ├── AddWebhookModal.jsx, FunctionEditor.jsx
│   │   ├── CampaignWizard.jsx, ICPCampaignWizard.jsx
│   └── pages/
│       ├── Dashboard.jsx, Calendar.jsx
│       ├── Meetings.jsx, MeetingDetail.jsx
│       ├── Outreach.jsx, CampaignDetail.jsx
│       ├── Webhooks.jsx, WebhookDetail.jsx
│       ├── Skills.jsx, Memory.jsx, AILog.jsx
│       └── Integrations.jsx
├── supabase/
│   ├── config.toml
│   └── functions/
│       ├── hermes-api/ (109-action API gateway)
│       ├── fathom-webhook/ (Fathom meeting receiver)
│       ├── register-fathom-webhook/ (Fathom API proxy)
│       ├── resend-webhook/ (email event tracking)
│       ├── cal-webhook/ (booking → nurture)
│       ├── nurture-sender/ (scheduled email sender)
│       ├── lead-magnet/ (hosted content server)
│       └── unsubscribe/ (email opt-out handler)
└── package.json
```

## THIS IS BEING FILMED
Every build is recorded for a YouTube crash course. Keep the code clean, explain decisions in comments, and make each build visually impressive when shown on screen.
