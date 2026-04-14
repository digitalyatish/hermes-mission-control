import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, ChevronDown, ChevronRight, Plug, Key, BookOpen, Zap } from 'lucide-react'

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hermes-api`

const API_REFERENCE = [
  {
    group: 'Meetings',
    color: '#00BFFF',
    actions: [
      {
        name: 'meetings.list',
        description: 'List meetings with optional search, type filter, tags filter, date range, and pagination.',
        request: `{ "action": "meetings.list", "params": { "search": "Acme", "type": "external", "tags": ["discovery", "hot_lead"], "date_from": "2026-01-01", "limit": 20, "offset": 0 } }`,
        response: `{ "ok": true, "data": { "meetings": [...], "total": 111, "limit": 20, "offset": 0 } }`,
      },
      {
        name: 'meetings.get',
        description: 'Get a single meeting with all fields including transcript, summary, action items, and custom data.',
        request: `{ "action": "meetings.get", "params": { "id": "<meeting_uuid>" } }`,
        response: `{ "ok": true, "data": { "id": "...", "title": "...", "transcript": [...], "summary_markdown": "...", "custom_notes": "...", "hermes_insights": {...} } }`,
      },
      {
        name: 'meetings.update_notes',
        description: 'Save personal notes on a meeting.',
        request: `{ "action": "meetings.update_notes", "params": { "id": "<meeting_uuid>", "custom_notes": "My notes here..." } }`,
        response: `{ "ok": true, "data": { "id": "...", "custom_notes": "..." } }`,
      },
      {
        name: 'meetings.update_proposal',
        description: 'Save a proposal draft for a meeting.',
        request: `{ "action": "meetings.update_proposal", "params": { "id": "<meeting_uuid>", "proposal_draft": "Dear..." } }`,
        response: `{ "ok": true, "data": { "id": "...", "proposal_draft": "..." } }`,
      },
      {
        name: 'meetings.add_action',
        description: 'Add a custom action item to a meeting.',
        request: `{ "action": "meetings.add_action", "params": { "id": "<meeting_uuid>", "text": "Follow up with Sarah" } }`,
        response: `{ "ok": true, "data": { "id": "...", "custom_action_items": [...] } }`,
      },
      {
        name: 'meetings.toggle_action',
        description: 'Toggle a custom action item done/undone by index.',
        request: `{ "action": "meetings.toggle_action", "params": { "id": "<meeting_uuid>", "index": 0 } }`,
        response: `{ "ok": true, "data": { "id": "...", "custom_action_items": [...] } }`,
      },
      {
        name: 'meetings.delete_action',
        description: 'Delete a custom action item by index.',
        request: `{ "action": "meetings.delete_action", "params": { "id": "<meeting_uuid>", "index": 0 } }`,
        response: `{ "ok": true, "data": { "id": "...", "custom_action_items": [...] } }`,
      },
      {
        name: 'meetings.update_insights',
        description: 'Write AI-generated insights back to a meeting. This is the key action for AI agents analyzing meetings.',
        request: `{ "action": "meetings.update_insights", "params": { "id": "<meeting_uuid>", "hermes_insights": { "sentiment": "Positive", "deal_probability": "High (80%)", "followup_urgency": "Within 48 hours", "decision_makers": ["Sarah VP", "Mike CTO"], "pricing_discussed": true, "next_steps": "Send proposal by Friday" } } }`,
        response: `{ "ok": true, "data": { "id": "...", "hermes_insights": {...} } }`,
      },
      {
        name: 'meetings.search_transcript',
        description: 'Full-text search across all meeting transcripts. Returns matching snippets with speaker names. Supports type and date filters.',
        request: `{ "action": "meetings.search_transcript", "params": { "query": "budget", "type": "external", "date_from": "2026-03-01", "limit": 20 } }`,
        response: `{ "ok": true, "data": { "results": [{ "meeting_id": "uuid", "title": "...", "meeting_date": "...", "company_name": "...", "matches": [{ "speaker": "Jake", "text": "...our budget is...", "timestamp": "00:12:34" }], "match_count": 3 }], "total": 15 } }`,
      },
      {
        name: 'meetings.add_tag',
        description: 'Add a tag to a meeting. Tags: discovery, qualified, proposal_sent, closed_won, closed_lost, hot_lead, upsell_opportunity, churn_risk, needs_followup, needs_analysis.',
        request: `{ "action": "meetings.add_tag", "params": { "id": "<meeting_uuid>", "tag": "hot_lead" } }`,
        response: `{ "ok": true, "data": { "id": "...", "tags": ["hot_lead"] } }`,
      },
      {
        name: 'meetings.remove_tag',
        description: 'Remove a tag from a meeting.',
        request: `{ "action": "meetings.remove_tag", "params": { "id": "<meeting_uuid>", "tag": "hot_lead" } }`,
        response: `{ "ok": true, "data": { "id": "...", "tags": [] } }`,
      },
      {
        name: 'meetings.bulk_get',
        description: 'Get multiple meetings in a single request (max 50). Set include_transcript=false to skip transcripts and keep responses fast.',
        request: `{ "action": "meetings.bulk_get", "params": { "ids": ["uuid1", "uuid2", "uuid3"], "include_transcript": false } }`,
        response: `{ "ok": true, "data": { "meetings": [{ "id": "uuid1", "title": "...", "summary_markdown": "...", "hermes_insights": {...} }] } }`,
      },
    ],
  },
  {
    group: 'Webhooks',
    color: '#FF6B35',
    actions: [
      {
        name: 'webhooks.list',
        description: 'List all registered webhooks.',
        request: `{ "action": "webhooks.list" }`,
        response: `{ "ok": true, "data": [{ "id": "...", "name": "...", "service": "fathom", "status": "active", "event_count": 5 }] }`,
      },
      {
        name: 'webhooks.get',
        description: 'Get a single webhook by ID.',
        request: `{ "action": "webhooks.get", "params": { "id": "<webhook_uuid>" } }`,
        response: `{ "ok": true, "data": { "id": "...", "name": "...", "endpoint_url": "...", "webhook_secret": "..." } }`,
      },
      {
        name: 'webhooks.register',
        description: 'Register a new webhook. For Fathom, automatically registers with the Fathom API.',
        request: `{ "action": "webhooks.register", "params": { "name": "My Webhook", "service": "fathom", "config": { "include_transcript": true, "include_summary": true } } }`,
        response: `{ "ok": true, "data": { "webhook": {...}, "endpoint_url": "...", "secret": "..." } }`,
      },
      {
        name: 'webhooks.update',
        description: 'Update webhook fields: name, status, callback_url, webhook_secret. Set callback_url to receive a POST notification when new meetings are ingested.',
        request: `{ "action": "webhooks.update", "params": { "id": "<webhook_uuid>", "callback_url": "https://your-server.com/notify" } }`,
        response: `{ "ok": true, "data": { "id": "...", "callback_url": "https://your-server.com/notify" } }`,
      },
      {
        name: 'webhooks.toggle',
        description: 'Toggle webhook status between active and paused.',
        request: `{ "action": "webhooks.toggle", "params": { "id": "<webhook_uuid>" } }`,
        response: `{ "ok": true, "data": { "id": "...", "status": "paused" } }`,
      },
      {
        name: 'webhooks.delete',
        description: 'Delete a webhook and all its functions.',
        request: `{ "action": "webhooks.delete", "params": { "id": "<webhook_uuid>" } }`,
        response: `{ "ok": true, "data": { "deleted": true } }`,
      },
    ],
  },
  {
    group: 'Functions',
    color: '#A855F7',
    actions: [
      {
        name: 'functions.list',
        description: 'List all processing functions for a webhook.',
        request: `{ "action": "functions.list", "params": { "webhook_id": "<webhook_uuid>" } }`,
        response: `{ "ok": true, "data": [{ "id": "...", "name": "...", "prompt": "...", "is_active": true, "execution_order": 0 }] }`,
      },
      {
        name: 'functions.create',
        description: 'Create a new processing function for a webhook.',
        request: `{ "action": "functions.create", "params": { "webhook_id": "<webhook_uuid>", "name": "Extract Deals", "prompt": "When a meeting comes in, analyze for deal signals...", "description": "Finds deal opportunities", "is_active": true } }`,
        response: `{ "ok": true, "data": { "id": "...", "name": "...", "execution_order": 0 } }`,
      },
      {
        name: 'functions.update',
        description: 'Update a function. Only include fields you want to change.',
        request: `{ "action": "functions.update", "params": { "id": "<function_uuid>", "prompt": "Updated instructions...", "is_active": false } }`,
        response: `{ "ok": true, "data": { "id": "...", "prompt": "Updated..." } }`,
      },
      {
        name: 'functions.delete',
        description: 'Delete a function.',
        request: `{ "action": "functions.delete", "params": { "id": "<function_uuid>" } }`,
        response: `{ "ok": true, "data": { "deleted": true } }`,
      },
      {
        name: 'functions.reorder',
        description: 'Set the execution order of functions.',
        request: `{ "action": "functions.reorder", "params": { "webhook_id": "<webhook_uuid>", "ordered_ids": ["id1", "id2", "id3"] } }`,
        response: `{ "ok": true, "data": { "reordered": true } }`,
      },
    ],
  },
  {
    group: 'Skills',
    color: '#A855F7',
    actions: [
      {
        name: 'skills.sync',
        description: 'Agent pushes its full skill inventory to Mission Control. Detects new, updated (by content_hash), and unchanged skills.',
        request: `{ "action": "skills.sync", "params": { "skills": [{ "name": "discovery-call-framework", "category": "sales", "version": "1.2", "description": "...", "tags": ["sales"], "source": "custom", "content_hash": "abc123", "skill_metadata": {} }] } }`,
        response: `{ "ok": true, "data": { "synced": 81, "new": 0, "updated": 3, "unchanged": 78 } }`,
      },
      {
        name: 'skills.list',
        description: 'List all skills with optional filters by category, source, tags, status, and search.',
        request: `{ "action": "skills.list", "params": { "category": "sales", "source": "custom", "tags": ["proposals"], "limit": 50 } }`,
        response: `{ "ok": true, "data": { "skills": [{ "id": "...", "name": "...", "category": "...", "version": "...", "source": "custom", "changelog_count": 5 }], "total": 81 } }`,
      },
      {
        name: 'skills.get',
        description: 'Get full skill details including recent changelog entries.',
        request: `{ "action": "skills.get", "params": { "name": "discovery-call-framework" } }`,
        response: `{ "ok": true, "data": { "id": "...", "name": "...", "skill_metadata": {...}, "recent_changes": [{ "change_type": "patched", "change_summary": "..." }] } }`,
      },
      {
        name: 'skills.log_change',
        description: 'Log a change to a skill\u2019s changelog. Link to a meeting if the change was triggered by meeting analysis.',
        request: `{ "action": "skills.log_change", "params": { "skill_name": "discovery-call-framework", "change_type": "patched", "change_summary": "Added new objection pattern from Jake call", "triggered_by": "meeting_learning", "meeting_id": "<uuid>" } }`,
        response: `{ "ok": true, "data": { "id": "...", "change_type": "patched", "skill_id": "..." } }`,
      },
      {
        name: 'skills.changelog',
        description: 'Get changelog across all skills. Filter by skill, change type, trigger source, date range.',
        request: `{ "action": "skills.changelog", "params": { "change_type": "patched", "triggered_by": "meeting_learning", "limit": 20 } }`,
        response: `{ "ok": true, "data": { "changes": [{ "skill_name": "...", "change_type": "patched", "change_summary": "...", "triggered_by": "meeting_learning" }], "total": 47 } }`,
      },
      {
        name: 'skills.stats',
        description: 'Dashboard summary: totals by source/category, changes this week, most active skills, learning sources.',
        request: `{ "action": "skills.stats" }`,
        response: `{ "ok": true, "data": { "total_skills": 81, "by_source": { "builtin": 75, "custom": 5 }, "changes_this_week": 12, "most_active_skills": [{ "name": "...", "changes": 8 }] } }`,
      },
      {
        name: 'skills.update_metadata',
        description: 'Update skill metadata, status, tags, or description without a full sync.',
        request: `{ "action": "skills.update_metadata", "params": { "name": "discovery-call-framework", "status": "active", "skill_metadata": { "close_rate": "73%" } } }`,
        response: `{ "ok": true, "data": { "id": "...", "name": "...", "skill_metadata": {...} } }`,
      },
    ],
  },
  {
    group: 'Feedback',
    color: '#F59E0B',
    actions: [
      {
        name: 'feedback.create',
        description: 'Create feedback on a meeting. Types: rating, correction, context, note, action_request. Auto-tags meeting with has_feedback.',
        request: `{ "action": "feedback.create", "params": { "meeting_id": "<uuid>", "feedback_type": "correction", "content": "Deal probability should be higher", "metadata": { "field": "deal_probability", "old_value": "Medium", "suggested_value": "High (85%)" } } }`,
        response: `{ "ok": true, "data": { "id": "...", "meeting_id": "...", "source": "user", "feedback_type": "correction", "content": "...", "is_read": false } }`,
      },
      {
        name: 'feedback.list',
        description: 'List feedback for a meeting or across all meetings. Filter by source, type, unread status.',
        request: `{ "action": "feedback.list", "params": { "meeting_id": "<uuid>", "unread_only": true, "limit": 20 } }`,
        response: `{ "ok": true, "data": { "feedback": [{ "id": "...", "meeting_id": "...", "source": "user", "feedback_type": "...", "content": "...", "is_read": false }], "total": 5 } }`,
      },
      {
        name: 'feedback.mark_read',
        description: 'Mark feedback entries as read (agent marks after processing).',
        request: `{ "action": "feedback.mark_read", "params": { "ids": ["<uuid1>", "<uuid2>"] } }`,
        response: `{ "ok": true, "data": { "marked": 2 } }`,
      },
      {
        name: 'feedback.respond',
        description: 'Agent responds to user feedback. Creates a new entry with source=agent linked to the original.',
        request: `{ "action": "feedback.respond", "params": { "reply_to": "<feedback_uuid>", "meeting_id": "<uuid>", "content": "Updated deal probability to 85%. Added hot_lead tag.", "metadata": { "actions_taken": ["updated_insights", "added_tag:hot_lead"] } } }`,
        response: `{ "ok": true, "data": { "id": "...", "source": "agent", "feedback_type": "note", "metadata": { "reply_to": "...", "actions_taken": [...] } } }`,
      },
      {
        name: 'feedback.stats',
        description: 'Get feedback summary: totals, unread counts, ratings breakdown, top corrected fields.',
        request: `{ "action": "feedback.stats" }`,
        response: `{ "ok": true, "data": { "total_feedback": 47, "unread_by_agent": 3, "ratings": { "up": 30, "down": 5 }, "corrections_this_week": 4, "top_corrected_fields": [{ "field": "deal_probability", "count": 8 }] } }`,
      },
    ],
  },
  {
    group: 'Cron Management',
    color: '#10B981',
    actions: [
      { name: 'cron.status', description: 'Get all crons with pause state, last run, runs today. Merges cron_pauses table with activity log.', request: '{ "action": "cron.status" }', response: '{ "ok": true, "data": { "crons": [{ "name": "campaign_manager", "paused": false, "last_run": "...", "runs_today": 6 }] } }' },
      { name: 'cron.pause', description: 'Pause a cron, a group ("outreach" = campaign_manager + nurture_personalizer + sdr_intelligence), or "all". Agent pre-check scripts read this table.', request: '{ "action": "cron.pause", "params": { "name": "campaign_manager", "reason": "No active campaigns" } }', response: '{ "ok": true, "data": { "paused": ["campaign_manager"] } }' },
      { name: 'cron.resume', description: 'Resume a cron, group, or "all".', request: '{ "action": "cron.resume", "params": { "name": "outreach" } }', response: '{ "ok": true, "data": { "resumed": ["campaign_manager", "nurture_personalizer", "sdr_intelligence"] } }' },
    ],
  },
  {
    group: 'Skill Builder',
    color: '#D946EF',
    actions: [
      { name: 'skill_builder.submit', description: 'Submit a URL, YouTube link, or raw text for skill extraction. Raw text is auto-extracted.', request: '{ "action": "skill_builder.submit", "params": { "input_type": "youtube", "input_url": "https://youtube.com/watch?v=abc", "input_title": "MCP Tutorial" } }', response: '{ "ok": true, "data": { "id": "...", "extraction_status": "pending" } }' },
      { name: 'skill_builder.list', description: 'List submissions with proposal counts.', request: '{ "action": "skill_builder.list", "params": { "processing_status": "completed" } }', response: '{ "ok": true, "data": { "submissions": [{ "proposal_count": 3, "approved_count": 1 }] } }' },
      { name: 'skill_builder.get', description: 'Get submission with all proposals.', request: '{ "action": "skill_builder.get", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "proposals": [...] } }' },
      { name: 'skill_builder.extract', description: 'Agent updates extracted content after fetching URL/transcript.', request: '{ "action": "skill_builder.extract", "params": { "id": "<uuid>", "extracted_content": "...", "extraction_status": "extracted" } }', response: '{ "ok": true, "data": {...} }' },
      { name: 'skill_builder.propose', description: 'Agent creates a skill proposal from extracted content.', request: '{ "action": "skill_builder.propose", "params": { "submission_id": "<uuid>", "skill_name": "mcp-server-setup", "skill_description": "...", "skill_content": "---\\nname: mcp-server-setup\\n...", "skill_tags": ["mcp"] } }', response: '{ "ok": true, "data": {...} }' },
      { name: 'skill_builder.approve', description: 'Approve a proposed skill.', request: '{ "action": "skill_builder.approve", "params": { "id": "<uuid>", "reviewer_notes": "Looks good" } }', response: '{ "ok": true, "data": { "status": "approved" } }' },
      { name: 'skill_builder.reject', description: 'Reject a proposed skill.', request: '{ "action": "skill_builder.reject", "params": { "id": "<uuid>", "reviewer_notes": "Too generic" } }', response: '{ "ok": true, "data": { "status": "rejected" } }' },
      { name: 'skill_builder.edit', description: 'Edit proposal content before approving.', request: '{ "action": "skill_builder.edit", "params": { "id": "<uuid>", "edited_content": "---\\nname: ...", "reviewer_notes": "Added config" } }', response: '{ "ok": true, "data": { "status": "edited" } }' },
    ],
  },
  {
    group: 'Calendar',
    color: '#06B6D4',
    actions: [
      { name: 'calendar.sync', description: 'Agent pushes events into the calendar cache. Upserts by (source, event_id). Use this to sync Google Calendar events so they appear on /calendar.', request: '{ "action": "calendar.sync", "params": { "events": [{ "source": "google", "event_id": "gcal-xxx", "title": "SRED Update", "start_time": "2026-04-09T08:00:00-07:00", "end_time": "2026-04-09T08:45:00-07:00", "color": "blue", "event_type": "meeting", "metadata": { "attendees": ["garri@sredadvisors.com"] } }] } }', response: '{ "ok": true, "data": { "synced": 25, "new": 25, "updated": 0 } }' },
      { name: 'calendar.events', description: 'Get unified calendar events from all sources (Google Calendar, agent crons, nurture sequences, campaign send windows).', request: '{ "action": "calendar.events", "params": { "date_from": "2026-04-07", "date_to": "2026-04-13", "sources": ["google", "crons", "nurture", "campaigns"] } }', response: '{ "ok": true, "data": { "events": [{ "id": "...", "source": "nurture", "title": "Discovery Call — John", "start": "2026-04-15T14:00:00Z", "color": "green", "type": "discovery_call" }] } }' },
    ],
  },
  {
    group: 'Activity',
    color: '#10B981',
    actions: [
      { name: 'activity.log', description: 'Agent logs an activity (cron run, email sent, meeting analyzed, etc.).', request: '{ "action": "activity.log", "params": { "activity_type": "cron_run", "source": "meeting_analyzer", "summary": "Analyzed 3 new meetings", "details": { "meetings_analyzed": 3 }, "status": "success", "duration_seconds": 45 } }', response: '{ "ok": true, "data": { "id": "...", "activity_type": "cron_run" } }' },
      { name: 'activity.list', description: 'List recent activities with filters.', request: '{ "action": "activity.list", "params": { "source": "meeting_analyzer", "limit": 50 } }', response: '{ "ok": true, "data": { "activities": [...], "total": 150 } }' },
      { name: 'activity.stats', description: 'Activity dashboard: totals, by source (last run, runs today, status), by type, recent errors.', request: '{ "action": "activity.stats" }', response: '{ "ok": true, "data": { "total_activities": 150, "today": 23, "by_source": { "meeting_analyzer": { "last_run": "...", "runs_today": 6 } } } }' },
      { name: 'campaigns.mark_ready', description: 'Agent marks campaign as ready for review after AI processing.', request: '{ "action": "campaigns.mark_ready", "params": { "id": "<uuid>", "agent_notes": "Generated 3-email PAS sequence for 45 leads." } }', response: '{ "ok": true, "data": { "status": "ready_for_review" } }' },
    ],
  },
  {
    group: 'Notify',
    color: '#00E676',
    actions: [
      {
        name: 'notify.send_email',
        description: 'Send an email via Resend. Defaults to mani@growthcreators.ai. Agents use this for alerts, reports, summaries, or any notification.',
        request: `{ "action": "notify.send_email", "params": { "subject": "Daily Briefing", "body_html": "<h2>Report</h2><p>5 meetings analyzed, 3 insights generated</p>", "to": "mani@growthcreators.ai" } }`,
        response: `{ "ok": true, "data": { "resend_id": "...", "to": "mani@growthcreators.ai", "subject": "Daily Briefing" } }`,
      },
    ],
  },
  {
    group: 'Memory',
    color: '#F59E0B',
    actions: [
      { name: 'memory.sync', description: 'Agent pushes persistent memory state. Detects new, unchanged, and removed entries.', request: '{ "action": "memory.sync", "params": { "memory_entries": [{"memory_type": "memory", "content": "..."}], "user_entries": [{"memory_type": "user", "content": "..."}] } }', response: '{ "ok": true, "data": { "memory_synced": 5, "user_synced": 2, "new": 0, "removed": 0 } }' },
      { name: 'memory.list', description: 'List persistent memory entries.', request: '{ "action": "memory.list", "params": { "memory_type": "memory", "include_inactive": false } }', response: '{ "ok": true, "data": { "entries": [...], "total": 5 } }' },
      { name: 'memory.history', description: 'Full history including replaced entries.', request: '{ "action": "memory.history", "params": { "memory_type": "memory", "limit": 50 } }', response: '{ "ok": true, "data": [...] }' },
      { name: 'memory.log_daily', description: 'Write or append to today\u2019s daily log. Sections are appended, not overwritten.', request: '{ "action": "memory.log_daily", "params": { "summary": "Built outreach system...", "decisions_made": "...", "things_learned": "...", "metrics": {"endpoints_built": 76} } }', response: '{ "ok": true, "data": { "log_date": "2026-04-08", "sync_count": 3 } }' },
      { name: 'memory.get_daily', description: 'Get a specific day\u2019s log.', request: '{ "action": "memory.get_daily", "params": { "date": "2026-04-08" } }', response: '{ "ok": true, "data": { "summary": "...", "decisions_made": "...", "metrics": {...} } }' },
      { name: 'memory.list_daily', description: 'List daily logs.', request: '{ "action": "memory.list_daily", "params": { "date_from": "2026-04-01", "limit": 30 } }', response: '{ "ok": true, "data": [...] }' },
      { name: 'memory.snapshot', description: 'Save a full context snapshot (before compaction, session end, etc.).', request: '{ "action": "memory.snapshot", "params": { "snapshot_type": "session_end", "title": "Mission Control complete", "session_summary": "...", "persistent_memory": "...", "key_context": "...", "cron_state": {...} } }', response: '{ "ok": true, "data": { "id": "...", "snapshot_type": "session_end" } }' },
      { name: 'memory.list_snapshots', description: 'List snapshots.', request: '{ "action": "memory.list_snapshots", "params": { "snapshot_type": "session_end", "limit": 20 } }', response: '{ "ok": true, "data": [...] }' },
      { name: 'memory.get_snapshot', description: 'Get full snapshot content.', request: '{ "action": "memory.get_snapshot", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "persistent_memory": "...", "cron_state": {...} } }' },
      { name: 'memory.stats', description: 'Dashboard summary: active entries, char usage, daily log streak, snapshot counts.', request: '{ "action": "memory.stats" }', response: '{ "ok": true, "data": { "persistent_memory": { "active_entries": 7, "total_chars": 2100 }, "daily_logs": { "streak_days": 5 }, "snapshots": { "total": 3 } } }' },
    ],
  },
  {
    group: 'Nurture',
    color: '#EC4899',
    actions: [
      { name: 'nurture.list', description: 'List nurture sequences.', request: '{ "action": "nurture.list", "params": { "status": "active", "limit": 20 } }', response: '{ "ok": true, "data": { "sequences": [...], "total": 3 } }' },
      { name: 'nurture.get', description: 'Get sequence with all emails.', request: '{ "action": "nurture.get", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "id": "...", "prospect_name": "...", "emails": [...] } }' },
      { name: 'nurture.create', description: 'Create a nurture sequence manually. Auto-creates lead and calculates email schedule.', request: '{ "action": "nurture.create", "params": { "prospect_name": "John", "prospect_email": "john@acme.com", "meeting_time": "2026-04-15T14:00:00Z", "booking_uid": "manual-001", "meeting_link": "https://meet.google.com/xxx" } }', response: '{ "ok": true, "data": { "sequence_id": "...", "emails_planned": 5 } }' },
      { name: 'nurture.update', description: 'Update sequence (industry, case studies, personalization notes).', request: '{ "action": "nurture.update", "params": { "id": "<uuid>", "prospect_industry": "dental", "matched_case_studies": ["dental-clinic-tx"] } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'nurture.cancel', description: 'Cancel a sequence and all scheduled emails.', request: '{ "action": "nurture.cancel", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "status": "cancelled" } }' },
      { name: 'nurture.reschedule', description: 'Update meeting time (recalculate email schedule manually).', request: '{ "action": "nurture.reschedule", "params": { "id": "<uuid>", "new_meeting_time": "2026-04-18T14:00:00Z" } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'nurture.emails.list', description: 'List emails for a sequence.', request: '{ "action": "nurture.emails.list", "params": { "sequence_id": "<uuid>" } }', response: '{ "ok": true, "data": [...] }' },
      { name: 'nurture.emails.update', description: 'Agent personalizes email content before send.', request: '{ "action": "nurture.emails.update", "params": { "id": "<uuid>", "subject": "...", "body_html": "..." } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'nurture.emails.send_now', description: 'Force-send a scheduled email immediately.', request: '{ "action": "nurture.emails.send_now", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "queued": true } }' },
      { name: 'nurture.emails.skip', description: 'Skip a scheduled email.', request: '{ "action": "nurture.emails.skip", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "status": "skipped" } }' },
      { name: 'nurture.queue', description: 'Get emails due to send (scheduled_at <= now). Agent can personalize before nurture-sender sends.', request: '{ "action": "nurture.queue", "params": { "limit": 20 } }', response: '{ "ok": true, "data": [{ "email_type": "value_1", "nurture_sequences": { "prospect_name": "..." } }] }' },
      { name: 'nurture.stats', description: 'Nurture performance: active sequences, open rates, upcoming meetings.', request: '{ "action": "nurture.stats" }', response: '{ "ok": true, "data": { "active_sequences": 3, "open_rate": 72.5, "upcoming_meetings": [...] } }' },
    ],
  },
  {
    group: 'ICPs',
    color: '#14B8A6',
    actions: [
      { name: 'icp.create', description: 'Create an ideal customer profile.', request: '{ "action": "icp.create", "params": { "name": "Canadian Accounting Firms", "industry_verticals": ["accounting"], "geographies": ["Vancouver"], "job_titles": ["Managing Partner"] } }', response: '{ "ok": true, "data": { "id": "...", "name": "..." } }' },
      { name: 'icp.list', description: 'List all ICPs.', request: '{ "action": "icp.list", "params": { "is_active": true } }', response: '{ "ok": true, "data": [...] }' },
      { name: 'icp.get', description: 'Get a single ICP.', request: '{ "action": "icp.get", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'icp.update', description: 'Update an ICP.', request: '{ "action": "icp.update", "params": { "id": "<uuid>", "name": "Updated" } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'icp.delete', description: 'Delete an ICP.', request: '{ "action": "icp.delete", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "deleted": true } }' },
    ],
  },
  {
    group: 'Leads',
    color: '#EC4899',
    actions: [
      { name: 'leads.create', description: 'Create a single lead.', request: '{ "action": "leads.create", "params": { "email": "john@acme.com", "first_name": "John", "company_name": "Acme", "source": "manual" } }', response: '{ "ok": true, "data": { "id": "...", "email": "..." } }' },
      { name: 'leads.bulk_create', description: 'Bulk import leads. Upserts by email.', request: '{ "action": "leads.bulk_create", "params": { "leads": [{"email": "...", "first_name": "..."}], "source": "csv_import", "icp_id": "<uuid>" } }', response: '{ "ok": true, "data": { "created": 45, "updated": 5, "skipped": 2 } }' },
      { name: 'leads.list', description: 'List leads with filters.', request: '{ "action": "leads.list", "params": { "status": "new", "source": "google_maps", "icp_id": "<uuid>", "limit": 50 } }', response: '{ "ok": true, "data": { "leads": [...], "total": 450 } }' },
      { name: 'leads.get', description: 'Get a single lead.', request: '{ "action": "leads.get", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'leads.update', description: 'Update a lead.', request: '{ "action": "leads.update", "params": { "id": "<uuid>", "status": "booked", "tags": ["hot"] } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'leads.search', description: 'Full-text search across leads.', request: '{ "action": "leads.search", "params": { "query": "accounting vancouver", "limit": 20 } }', response: '{ "ok": true, "data": [...] }' },
      { name: 'leads.example_csv', description: 'Get example CSV format for imports.', request: '{ "action": "leads.example_csv" }', response: '{ "ok": true, "data": { "csv": "...", "columns": [...], "required_columns": ["email"] } }' },
    ],
  },
  {
    group: 'Campaigns',
    color: '#F59E0B',
    actions: [
      { name: 'campaigns.create', description: 'Create a campaign with templates, AI level, and sequence config.', request: '{ "action": "campaigns.create", "params": { "name": "Q2 Outreach", "ai_level": "full", "sequence_steps": 3, "step_delays": [3, 5] } }', response: '{ "ok": true, "data": { "id": "...", "status": "draft" } }' },
      { name: 'campaigns.list', description: 'List campaigns.', request: '{ "action": "campaigns.list", "params": { "status": "active" } }', response: '{ "ok": true, "data": { "campaigns": [...], "total": 5 } }' },
      { name: 'campaigns.get', description: 'Get campaign details.', request: '{ "action": "campaigns.get", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'campaigns.update', description: 'Update campaign settings.', request: '{ "action": "campaigns.update", "params": { "id": "<uuid>", "daily_send_limit": 50 } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'campaigns.add_leads', description: 'Add leads to a campaign by IDs or filter.', request: '{ "action": "campaigns.add_leads", "params": { "campaign_id": "<uuid>", "lead_ids": ["uuid1", "uuid2"] } }', response: '{ "ok": true, "data": { "added": 2, "total_leads": 52 } }' },
      { name: 'campaigns.remove_leads', description: 'Remove leads from a campaign.', request: '{ "action": "campaigns.remove_leads", "params": { "campaign_id": "<uuid>", "lead_ids": ["uuid1"] } }', response: '{ "ok": true, "data": { "removed": 1 } }' },
      { name: 'campaigns.launch', description: 'Launch a campaign (validates leads and templates).', request: '{ "action": "campaigns.launch", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "status": "active" } }' },
      { name: 'campaigns.pause', description: 'Pause a campaign.', request: '{ "action": "campaigns.pause", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "status": "paused" } }' },
      { name: 'campaigns.resume', description: 'Resume a paused campaign.', request: '{ "action": "campaigns.resume", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "status": "active" } }' },
      { name: 'campaigns.stats', description: 'Get detailed campaign performance stats and rates.', request: '{ "action": "campaigns.stats", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { "total_sent": 90, "rates": { "open_rate": 37.8, "reply_rate": 5.6 } } }' },
    ],
  },
  {
    group: 'Emails',
    color: '#EF4444',
    actions: [
      { name: 'emails.send', description: 'Send a single email via Resend. Auto-appends unsubscribe footer.', request: '{ "action": "emails.send", "params": { "campaign_id": "<uuid>", "campaign_lead_id": "<uuid>", "lead_id": "<uuid>", "to_email": "john@acme.com", "subject": "Quick question", "body_html": "<p>Hi John...</p>", "step_number": 1 } }', response: '{ "ok": true, "data": { "send_id": "...", "resend_id": "..." } }' },
      { name: 'emails.send_batch', description: 'Send up to 50 emails in one call.', request: '{ "action": "emails.send_batch", "params": { "emails": [{ "to_email": "...", "subject": "...", "body_html": "..." }] } }', response: '{ "ok": true, "data": { "sent": 48, "failed": 2 } }' },
      { name: 'emails.queue', description: 'Get emails ready to send (respects schedule, limits).', request: '{ "action": "emails.queue", "params": { "limit": 50 } }', response: '{ "ok": true, "data": [{ "lead": {...}, "campaign": {...} }] }' },
    ],
  },
  {
    group: 'Lead Magnets',
    color: '#8B5CF6',
    actions: [
      { name: 'lead_magnets.generate', description: 'Create a lead magnet placeholder with hosted URL.', request: '{ "action": "lead_magnets.generate", "params": { "lead_id": "<uuid>", "title": "AI Opportunity Brief for Acme" } }', response: '{ "ok": true, "data": { "id": "...", "hosted_url": "..." } }' },
      { name: 'lead_magnets.update', description: 'Update lead magnet content.', request: '{ "action": "lead_magnets.update", "params": { "id": "<uuid>", "content_html": "<h1>Report</h1>..." } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'lead_magnets.get', description: 'Get a lead magnet.', request: '{ "action": "lead_magnets.get", "params": { "id": "<uuid>" } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'lead_magnets.list', description: 'List lead magnets.', request: '{ "action": "lead_magnets.list", "params": { "campaign_id": "<uuid>" } }', response: '{ "ok": true, "data": [...] }' },
    ],
  },
  {
    group: 'Scrapers',
    color: '#06B6D4',
    actions: [
      { name: 'scrapers.run', description: 'Run a Google Maps scraper via Apify. Auto-imports leads and optionally creates a campaign. Uses compass/crawler-google-places actor.', request: '{ "action": "scrapers.run", "params": { "scraper_type": "google_maps", "query": "dental clinics in Vancouver BC", "max_results": 20, "icp_id": "<uuid>", "auto_create_campaign": true, "campaign_name": "Dental — Vancouver Outreach" } }', response: '{ "ok": true, "data": { "run_id": "...", "status": "completed", "leads_created": 18, "campaign_id": "...", "cost_usd": 0.0008 } }' },
      { name: 'scrapers.collect', description: 'Get raw results from an Apify dataset (for runs that completed or are still in progress).', request: '{ "action": "scrapers.collect", "params": { "run_id": "<uuid>" } }', response: '{ "ok": true, "data": { "results": 20, "items": [{ "title": "...", "phone": "...", "website": "..." }] } }' },
      { name: 'scrapers.status', description: 'Check scraper run progress.', request: '{ "action": "scrapers.status", "params": { "run_id": "<uuid>" } }', response: '{ "ok": true, "data": { "status": "completed", "leads_created": 45 } }' },
      { name: 'scrapers.list_sources', description: 'List available scraper types.', request: '{ "action": "scrapers.list_sources" }', response: '{ "ok": true, "data": { "sources": [{ "type": "google_maps", "name": "Google Maps via Apify" }] } }' },
    ],
  },
  {
    group: 'Outreach Insights',
    color: '#D946EF',
    actions: [
      { name: 'outreach_insights.create', description: 'Agent logs a learning about outreach performance.', request: '{ "action": "outreach_insights.create", "params": { "campaign_id": "<uuid>", "insight_type": "subject_line", "finding": "Company name in subject gets 42% higher opens", "confidence": 85 } }', response: '{ "ok": true, "data": { ... } }' },
      { name: 'outreach_insights.list', description: 'List outreach insights.', request: '{ "action": "outreach_insights.list", "params": { "campaign_id": "<uuid>" } }', response: '{ "ok": true, "data": [...] }' },
      { name: 'outreach.stats', description: 'Overall outreach dashboard stats.', request: '{ "action": "outreach.stats" }', response: '{ "ok": true, "data": { "total_leads": 450, "active_campaigns": 2, "overall_rates": { "open_rate": 35.2 } } }' },
    ],
  },
  {
    group: 'Stats',
    color: '#00E676',
    actions: [
      {
        name: 'stats.get',
        description: 'Get dashboard aggregate statistics.',
        request: `{ "action": "stats.get" }`,
        response: `{ "ok": true, "data": { "total_meetings": 111, "external_meetings": 78, "unique_companies": 9, "total_hours": 74, "weekly_trend": [...], "top_companies": [...] } }`,
      },
    ],
  },
]

function generateFullDocs(apiKey) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const lines = [
    '# Hermes Mission Control — API Reference',
    '',
    '## Base URL',
    `\`${API_BASE}\``,
    '',
    '## Authentication',
    'All requests require an API key. Send it as either:',
    '- `Authorization: Bearer <API_KEY>` header',
    '- `X-API-Key: <API_KEY>` header',
    '',
    apiKey ? `Your API Key: \`${apiKey}\`` : 'API Key: Set in your integration settings.',
    '',
    '## Request Format',
    'All requests are POST with JSON body:',
    '```json',
    '{ "action": "<action_name>", "params": { ... } }',
    '```',
    '',
    '## Response Format',
    '```json',
    '{ "ok": true, "data": { ... } }   // success',
    '{ "ok": false, "error": "..." }    // error',
    '```',
    '',
    '## Example (curl)',
    '```bash',
    `curl -X POST "${API_BASE}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "X-API-Key: ${apiKey || '<YOUR_API_KEY>'}" \\`,
    `  -d '{"action": "meetings.list", "params": {"limit": 5}}'`,
    '```',
    '',
    '## System Info',
    '',
    '### Edge Functions (standalone)',
    `- **Fathom Webhook**: \`${supabaseUrl}/functions/v1/fathom-webhook?id=<webhook_id>\` — receives Fathom meeting data, auto-saves to meetings table`,
    `- **Resend Webhook**: \`${supabaseUrl}/functions/v1/resend-webhook\` — receives Resend email events (opens, clicks, bounces), updates campaign tracking`,
    `- **Unsubscribe**: \`${supabaseUrl}/functions/v1/unsubscribe?email=<email>&campaign=<id>\` — handles email unsubscribe requests`,
    `- **Lead Magnet**: \`${supabaseUrl}/functions/v1/lead-magnet?id=<magnet_id>\` — serves hosted lead magnets as branded HTML pages`,
    `- **Cal.com Webhook**: \`${supabaseUrl}/functions/v1/cal-webhook\` — handles Cal.com booking events (BOOKING_CREATED, RESCHEDULED, CANCELLED), auto-creates nurture sequences`,
    `- **Nurture Sender**: \`${supabaseUrl}/functions/v1/nurture-sender\` — cron-triggered (every 15 min), sends scheduled nurture emails via Resend`,
    '',
    '### Email Sending',
    '- Default sender: `Mani Kanasani <mani@updates.growthcreators.ai>`',
    '- Reply-to: `mani@growthcreators.ai`',
    '- All outreach emails auto-include unsubscribe footer',
    '- Use `notify.send_email` for alerts/reports to Mani',
    '- Use `emails.send` / `emails.send_batch` for campaign outreach via Resend',
    '',
    '### Database Tables',
    '- **Meetings**: fathom_meetings (111+ records, auto-synced via Fathom webhook)',
    '- **Feedback**: meeting_feedback (user/agent communication per meeting)',
    '- **Webhooks**: webhooks, webhook_events, webhook_functions',
    '- **Skills**: agent_skills, skill_changelog',
    '- **Memory**: agent_memory, memory_daily_logs, memory_snapshots',
    '- **Outreach**: icps, leads, campaigns, campaign_leads, email_sends, email_events, outreach_insights, scraper_runs, lead_magnets',
    '- **Nurture**: nurture_sequences, nurture_emails',
    '',
    `### Total: 112 API actions across 20 groups`,
    '',
  ]

  for (const group of API_REFERENCE) {
    lines.push(`## ${group.group}`, '')
    for (const a of group.actions) {
      lines.push(`### \`${a.name}\``)
      lines.push(a.description)
      lines.push('')
      lines.push('**Request:**')
      lines.push('```json')
      lines.push(a.request)
      lines.push('```')
      lines.push('')
      lines.push('**Response:**')
      lines.push('```json')
      lines.push(a.response)
      lines.push('```')
      lines.push('')
    }
  }

  return lines.join('\n')
}

function CodeBlock({ code, onCopy }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (onCopy) onCopy()
  }
  return (
    <div className="relative group">
      <pre className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm font-mono text-white/60 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/[0.05] text-white/30 hover:text-[#00BFFF] opacity-0 group-hover:opacity-100 transition-all duration-150"
      >
        {copied ? <Check size={14} className="text-[#00E676]" /> : <Copy size={14} />}
      </button>
    </div>
  )
}

export default function Integrations() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [copiedDocs, setCopiedDocs] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  useEffect(() => {
    // Load from localStorage first, fall back to env var
    const stored = localStorage.getItem('hermes_api_key')
    if (stored) {
      setApiKey(stored)
    } else if (import.meta.env.VITE_HERMES_API_KEY) {
      setApiKey(import.meta.env.VITE_HERMES_API_KEY)
      localStorage.setItem('hermes_api_key', import.meta.env.VITE_HERMES_API_KEY)
    }
  }, [])

  function saveKey(val) {
    setApiKey(val)
    localStorage.setItem('hermes_api_key', val)
  }

  function toggleGroup(name) {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function copyFullDocs() {
    navigator.clipboard.writeText(generateFullDocs(apiKey))
    setCopiedDocs(true)
    setTimeout(() => setCopiedDocs(false), 3000)
  }

  function copyUrl() {
    navigator.clipboard.writeText(API_BASE)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-[1000px] mx-auto space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight neon-text">Integrations</h1>
        <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#00BFFF] to-transparent" />
        <p className="mt-4 text-[15px] font-body text-white/50">Connect AI agents and external tools to Mission Control</p>
      </div>

      {/* Copy Full Docs — the killer feature */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.25 }}
        className="glass-static p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#00BFFF]/10 border border-[#00BFFF]/20 flex items-center justify-center">
            <BookOpen size={20} className="text-[#00BFFF]" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-white">Quick Start</h2>
            <p className="text-[13px] font-mono text-white/40">Copy the full API reference and paste it into any AI agent</p>
          </div>
        </div>
        <button
          onClick={copyFullDocs}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-xl bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-base font-mono font-semibold hover:bg-[#00BFFF]/20 transition-all duration-150 shadow-[0_0_30px_-10px_rgba(0,191,255,0.2)]"
        >
          {copiedDocs ? <Check size={20} /> : <Copy size={20} />}
          {copiedDocs ? 'Copied! Paste into your AI agent.' : 'Copy Full API Reference'}
        </button>
      </motion.div>

      {/* Base URL + API Key */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.25 }}
        className="glass-static p-8 space-y-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center">
            <Plug size={20} className="text-[#FF6B35]" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-heading font-bold text-white">Connection Details</h2>
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">API Base URL</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm font-mono text-[#00BFFF]/80 truncate">
              {API_BASE}
            </div>
            <button onClick={copyUrl} className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-[#00BFFF] transition-colors">
              {copiedUrl ? <Check size={16} className="text-[#00E676]" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">API Key</label>
          <div className="flex items-center gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => saveKey(e.target.value)}
              placeholder="Paste your HERMES_API_KEY here"
              className="flex-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm font-mono text-white/60 placeholder:text-white/25 focus:outline-none focus:border-[#00BFFF]/30 transition-all duration-150"
            />
            <button onClick={() => setShowKey(!showKey)} className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white transition-colors text-xs font-mono">
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(apiKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) }}
              className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-[#00BFFF] transition-colors"
            >
              {copiedKey ? <Check size={16} className="text-[#00E676]" /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-[11px] font-body text-white/25 mt-1.5">Stored locally in your browser. Never sent to the server.</p>
        </div>

        {/* Auth example */}
        <div>
          <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Example Request</label>
          <CodeBlock code={`curl -X POST "${API_BASE}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey || '<YOUR_API_KEY>'}" \\
  -d '{"action": "meetings.list", "params": {"limit": 5}}'`} />
        </div>
      </motion.div>

      {/* API Reference */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.25 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
            <Zap size={20} className="text-[#A855F7]" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-heading font-bold text-white">API Reference</h2>
        </div>

        {API_REFERENCE.map(group => (
          <div key={group.group} className="glass-static overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.group)}
              className="w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-all duration-150"
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ background: group.color, boxShadow: `0 0 8px ${group.color}60` }} />
                <span className="text-lg font-heading font-bold text-white">{group.group}</span>
                <span className="text-[13px] font-mono text-white/30">{group.actions.length} endpoints</span>
              </div>
              {expandedGroups[group.group]
                ? <ChevronDown size={18} className="text-white/30" />
                : <ChevronRight size={18} className="text-white/30" />
              }
            </button>

            {/* Expanded actions */}
            {expandedGroups[group.group] && (
              <div className="border-t border-white/[0.06]">
                {group.actions.map((a, i) => (
                  <div key={a.name} className={`p-6 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <code className="text-base font-mono font-semibold" style={{ color: group.color }}>{a.name}</code>
                    </div>
                    <p className="text-sm font-body text-white/60 mb-4 leading-relaxed">{a.description}</p>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] font-mono tracking-[0.15em] text-white/40 uppercase">Request</span>
                        <CodeBlock code={a.request} />
                      </div>
                      <div>
                        <span className="text-[11px] font-mono tracking-[0.15em] text-white/40 uppercase">Response</span>
                        <CodeBlock code={a.response} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </motion.div>

      {/* Response format */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.25 }}
        className="glass-static p-8"
      >
        <h3 className="text-lg font-heading font-bold text-white mb-4">Response Format</h3>
        <p className="text-sm font-body text-white/60 mb-4">All responses use a consistent envelope:</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-mono tracking-[0.15em] text-[#00E676]/60 uppercase">Success</span>
            <CodeBlock code={`{ "ok": true, "data": { ... } }`} />
          </div>
          <div>
            <span className="text-[11px] font-mono tracking-[0.15em] text-[#FF3D00]/60 uppercase">Error</span>
            <CodeBlock code={`{ "ok": false, "error": "..." }`} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
