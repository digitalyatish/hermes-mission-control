import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft, Clock, Calendar, Users, Globe, ExternalLink,
  CheckSquare, MessageSquare, Brain, FileText, StickyNote,
  ListTodo, MessageCircle, Search, Trash2, Check,
  TrendingUp, AlertCircle, DollarSign, Heart, ArrowRight,
  Hash, Sparkles, Save
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import MeetingFeedback from '../components/MeetingFeedback'

// Safely parse JSON that may be double-encoded (string inside JSONB)
function safeParseJson(value, fallback = []) {
  if (value == null) return fallback
  try {
    let parsed = value
    // Keep parsing while it's still a string (handles double/triple encoding)
    while (typeof parsed === 'string') {
      parsed = JSON.parse(parsed)
    }
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

const SPEAKER_COLORS = ['#00BFFF', '#FF6B35', '#00E676', '#A855F7', '#F59E0B', '#EC4899', '#14B8A6', '#EF4444']

function getSpeakerColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length]
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function InsightCard({ label, value, icon: Icon, color }) {
  if (!value) return null
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.08]">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.5} />
        <span className="text-[11px] font-mono text-white/50 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="text-base font-body text-white/80 leading-relaxed">{value}</p>
    </div>
  )
}

const SECTIONS = [
  { id: 'section-summary', label: 'AI Summary', icon: Sparkles },
  { id: 'section-actions', label: 'Actions', icon: CheckSquare },
  { id: 'section-notes', label: 'Notes', icon: StickyNote },
  { id: 'section-proposal', label: 'Proposal', icon: FileText },
  { id: 'section-custom-actions', label: 'My Tasks', icon: ListTodo },
  { id: 'section-insights', label: 'Insights', icon: Brain },
  { id: 'section-feedback', label: 'Feedback', icon: MessageCircle },
  { id: 'section-transcript', label: 'Transcript', icon: MessageCircle },
]

export default function MeetingDetail() {
  const { id } = useParams()
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)

  const [customNotes, setCustomNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  const [proposal, setProposal] = useState('')
  const [proposalSaving, setProposalSaving] = useState(false)
  const [proposalSaved, setProposalSaved] = useState(false)

  const [customActions, setCustomActions] = useState([])
  const [newAction, setNewAction] = useState('')

  const [transcriptSearch, setTranscriptSearch] = useState('')
  const [activeSection, setActiveSection] = useState('section-summary')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('fathom_meetings')
        .select('*')
        .eq('id', id)
        .single()
      if (data) {
        setMeeting(data)
        setCustomNotes(data.custom_notes || '')
        setProposal(data.proposal_draft || '')
        setCustomActions(data.custom_action_items || [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [meeting])

  async function saveNotes() {
    setNotesSaving(true)
    await supabase.from('fathom_meetings').update({ custom_notes: customNotes }).eq('id', id)
    setNotesSaving(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function saveProposal() {
    setProposalSaving(true)
    await supabase.from('fathom_meetings').update({ proposal_draft: proposal }).eq('id', id)
    setProposalSaving(false)
    setProposalSaved(true)
    setTimeout(() => setProposalSaved(false), 2000)
  }

  async function addAction() {
    if (!newAction.trim()) return
    const updated = [...customActions, { text: newAction.trim(), done: false, created_at: new Date().toISOString() }]
    setCustomActions(updated)
    setNewAction('')
    await supabase.from('fathom_meetings').update({ custom_action_items: updated }).eq('id', id)
  }

  async function toggleAction(index) {
    const updated = customActions.map((a, i) => i === index ? { ...a, done: !a.done } : a)
    setCustomActions(updated)
    await supabase.from('fathom_meetings').update({ custom_action_items: updated }).eq('id', id)
  }

  async function deleteAction(index) {
    const updated = customActions.filter((_, i) => i !== index)
    setCustomActions(updated)
    await supabase.from('fathom_meetings').update({ custom_action_items: updated }).eq('id', id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#00BFFF]/30 border-t-[#00BFFF] rounded-full animate-spin mx-auto mb-6" />
          <p className="font-mono text-sm text-white/60">Loading meeting data...</p>
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-base text-white/50">Meeting not found</p>
        <Link to="/meetings" className="text-[#00BFFF] text-sm mt-4 inline-block hover:underline">Back to meetings</Link>
      </div>
    )
  }

  const attendees = safeParseJson(meeting.attendees, [])
  const actionItems = safeParseJson(meeting.action_items, [])
  const transcript = safeParseJson(meeting.transcript, [])
  const insights = meeting.hermes_insights
  const wordCount = typeof meeting.transcript_text === 'string' && meeting.transcript_text
    ? meeting.transcript_text.split(/\s+/).length : 0

  const filteredTranscript = transcriptSearch && Array.isArray(transcript)
    ? transcript.filter(e => {
        const text = typeof e?.text === 'string' ? e.text.toLowerCase() : ''
        const speaker = typeof e?.speaker?.display_name === 'string' ? e.speaker.display_name.toLowerCase() : ''
        return text.includes(transcriptSearch.toLowerCase()) || speaker.includes(transcriptSearch.toLowerCase())
      })
    : (Array.isArray(transcript) ? transcript : [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-[1200px] mx-auto space-y-8"
    >
      {/* Back */}
      <Link to="/meetings" className="inline-flex items-center gap-2 text-sm font-mono text-white/50 hover:text-[#00BFFF] transition-colors duration-150">
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to meetings
      </Link>

      {/* ===== MEETING HEADER ===== */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="glass-static" style={{ padding: 40 }}>
        {/* Tag row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-[0.2em] font-semibold border ${
              meeting.meeting_type === 'external'
                ? 'bg-[#00BFFF]/10 text-[#00BFFF] border-[#00BFFF]/20'
                : 'bg-[#FF6B35]/10 text-[#FF6B35] border-[#FF6B35]/20'
            }`}>
              {meeting.meeting_type?.toUpperCase()}
            </span>
            {meeting.company_name && (
              <span className="text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase">{meeting.company_name}</span>
            )}
            {meeting.company_domain && !meeting.company_name && (
              <span className="text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase">{meeting.company_domain}</span>
            )}
          </div>
          {meeting.fathom_url && (
            <a
              href={meeting.fathom_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.03] text-sm font-mono text-white/60 hover:text-[#00BFFF] hover:bg-[#00BFFF]/10 transition-all duration-150 border border-white/[0.08] hover:border-[#00BFFF]/20"
            >
              <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
              Open in Fathom
            </a>
          )}
        </div>

        {/* Title with underline accent */}
        <h1 className="text-5xl font-heading font-bold text-white leading-tight neon-text">{meeting.title}</h1>
        <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#00BFFF] to-transparent mb-6" />

        {/* Attendee avatars */}
        {attendees.length > 0 && (
          <div className="flex items-center mb-6">
            <div className="flex -space-x-2">
              {attendees.map((a, i) => {
                const name = a.display_name || a.name || a.email || '?'
                const color = getSpeakerColor(name)
                return (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-mono font-bold border-2 border-[#0A0A0F] cursor-default relative"
                    style={{ background: `${color}25`, color, zIndex: attendees.length - i }}
                    title={`${name}${a.email ? ` (${a.email})` : ''}`}
                  >
                    {getInitials(name)}
                  </div>
                )
              })}
            </div>
            <span className="text-sm font-body text-white/60 ml-4">
              {attendees.length} attendee{attendees.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-6 text-sm font-mono text-white/60 mb-8">
          {meeting.meeting_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#00BFFF]/50" strokeWidth={1.5} />
              {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
          {meeting.duration_minutes && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00BFFF]/50" strokeWidth={1.5} />
              {meeting.duration_minutes} minutes
            </div>
          )}
          {meeting.recorded_by_name && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00BFFF]/50" strokeWidth={1.5} />
              Recorded by {meeting.recorded_by_name}
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className="flex flex-wrap gap-4 pt-8 border-t border-white/[0.06]">
          {[
            { label: 'Words', value: wordCount.toLocaleString() },
            { label: 'Actions', value: actionItems.length },
            { label: 'Attendees', value: attendees.length },
            ...(meeting.duration_minutes ? [{ label: 'Minutes', value: meeting.duration_minutes }] : []),
          ].map(s => (
            <div key={s.label} className="px-5 py-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
              <p className="text-[24px] font-heading font-bold text-white leading-none">{s.value}</p>
              <p className="text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ===== TWO-COLUMN LAYOUT ===== */}
      <div className="flex gap-8">
        {/* Sticky Section Nav — 240px, 44px items */}
        <nav className="w-[240px] flex-shrink-0 sticky top-8 self-start hidden xl:block border-r border-white/5" style={{ paddingRight: 20 }}>
          <div className="space-y-1">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`flex items-center gap-3 rounded-lg font-body transition-all duration-150 border-l-2 ${
                  activeSection === s.id
                    ? 'text-[#67E8F9] border-l-[#00BFFF] bg-gradient-to-r from-[#00BFFF]/10 to-transparent'
                    : 'text-white/50 border-transparent hover:text-white hover:bg-white/[0.04]'
                }`}
                style={{ minHeight: 44, paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, fontSize: 15, fontWeight: 500 }}
              >
                <s.icon size={18} strokeWidth={1.5} />
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-8 min-w-0 max-w-[760px]">
          {/* ===== SECTION 1: AI SUMMARY ===== */}
          <motion.section
            id="section-summary"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.2, ease: 'easeOut' }}
            className="glass-static p-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-[#00BFFF]/10 border border-[#00BFFF]/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#00BFFF]" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[28px] font-heading font-bold text-white leading-tight">AI Summary</h2>
                <p className="text-[13px] font-mono text-white/50 mt-0.5">Generated by Fathom</p>
              </div>
            </div>
            {meeting.summary_markdown ? (
              <div className="prose-hermes">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{meeting.summary_markdown}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-base text-white/50 font-body">No summary available for this meeting.</p>
            )}
          </motion.section>

          {/* ===== SECTION 2: FATHOM ACTION ITEMS ===== */}
          <motion.section
            id="section-actions"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.2, ease: 'easeOut' }}
            className="glass-static p-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
                <CheckSquare className="w-4 h-4 text-[#00E676]" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[22px] font-heading font-bold text-white leading-tight">Action Items</h2>
                <p className="text-[13px] font-mono text-white/50 mt-0.5">{actionItems.length} items from Fathom</p>
              </div>
            </div>
            {actionItems.length > 0 ? (
              <div className="space-y-3">
                {actionItems.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.2, ease: 'easeOut' }}
                    className="flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-[#00E676]/20 transition-all duration-150"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#00E676]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckSquare className="w-4 h-4 text-[#00E676]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-base font-body text-white/80 leading-relaxed">
                        {typeof item === 'string' ? item : item.text || item.description || JSON.stringify(item)}
                      </p>
                      {item.assignee && (
                        <p className="text-sm font-mono text-white/50 mt-2">
                          Assigned to: {typeof item.assignee === 'string' ? item.assignee : item.assignee?.name || item.assignee?.email || ''}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-base text-white/50 font-body">No action items for this meeting.</p>
            )}
          </motion.section>

          {/* ===== SECTION 3: PERSONAL NOTES ===== */}
          <motion.section
            id="section-notes"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.2, ease: 'easeOut' }}
            className="glass-static p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
                  <StickyNote className="w-4 h-4 text-[#A855F7]" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-[22px] font-heading font-bold text-white leading-tight">Personal Notes</h2>
                  <p className="text-[13px] font-mono text-white/50 mt-0.5">Your private notes about this meeting</p>
                </div>
              </div>
              <button
                onClick={saveNotes}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all duration-150 border ${
                  notesSaved
                    ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20'
                    : 'bg-[#00BFFF]/10 text-[#00BFFF] border-[#00BFFF]/20 hover:bg-[#00BFFF]/20'
                }`}
              >
                <Save className="w-4 h-4" strokeWidth={1.5} />
                {notesSaving ? 'Saving...' : notesSaved ? 'Saved!' : 'Save Notes'}
              </button>
            </div>
            <textarea
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
              placeholder="Add your notes about this meeting..."
              className="w-full h-48 p-5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#00BFFF]/30 focus:ring-1 focus:ring-[#00BFFF]/20 resize-y transition-all duration-150 leading-relaxed"
            />
          </motion.section>

          {/* ===== SECTION 4: PROPOSAL DRAFT ===== */}
          <motion.section
            id="section-proposal"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.2, ease: 'easeOut' }}
            className="glass-static p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#FF6B35]" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-[22px] font-heading font-bold text-white leading-tight">Proposal Draft</h2>
                  <p className="text-[13px] font-mono text-white/50 mt-0.5">Draft your proposal based on meeting insights</p>
                </div>
              </div>
              <button
                onClick={saveProposal}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all duration-150 border ${
                  proposalSaved
                    ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20'
                    : 'bg-[#FF6B35]/10 text-[#FF6B35] border-[#FF6B35]/20 hover:bg-[#FF6B35]/20'
                }`}
              >
                <Save className="w-4 h-4" strokeWidth={1.5} />
                {proposalSaving ? 'Saving...' : proposalSaved ? 'Saved!' : 'Save Proposal'}
              </button>
            </div>
            <textarea
              value={proposal}
              onChange={e => setProposal(e.target.value)}
              placeholder="Start drafting your proposal here..."
              className="w-full h-64 p-5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35]/30 focus:ring-1 focus:ring-[#FF6B35]/20 resize-y transition-all duration-150 leading-relaxed"
            />
          </motion.section>

          {/* ===== SECTION 5: CUSTOM ACTION ITEMS ===== */}
          <motion.section
            id="section-custom-actions"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.2, ease: 'easeOut' }}
            className="glass-static p-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center">
                <ListTodo className="w-4 h-4 text-[#14B8A6]" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[22px] font-heading font-bold text-white leading-tight">My Action Items</h2>
                <p className="text-[13px] font-mono text-white/50 mt-0.5">Your personal tasks from this meeting</p>
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              <input
                value={newAction}
                onChange={e => setNewAction(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addAction()}
                placeholder="Add a new action item..."
                className="flex-1 px-5 py-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6]/30 transition-all duration-150"
              />
              <button
                onClick={addAction}
                className="px-6 py-3.5 rounded-xl bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/20 font-mono text-sm font-semibold hover:bg-[#14B8A6]/20 transition-all duration-150"
              >
                + Add
              </button>
            </div>

            <div className="space-y-2">
              {customActions.map((action, i) => (
                <div key={i} className="flex items-center gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.08] group hover:border-white/[0.12] transition-all duration-150">
                  <button
                    onClick={() => toggleAction(i)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
                      action.done
                        ? 'bg-[#00E676]/20 border-[#00E676]/40'
                        : 'border-white/20 hover:border-[#14B8A6]/40'
                    }`}
                  >
                    {action.done && <Check className="w-3.5 h-3.5 text-[#00E676]" strokeWidth={2} />}
                  </button>
                  <span className={`flex-1 text-base font-body leading-relaxed transition-all ${action.done ? 'text-white/30 line-through' : 'text-white/80'}`}>
                    {action.text}
                  </span>
                  <button
                    onClick={() => deleteAction(i)}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-[#FF3D00] transition-all duration-150"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
              {customActions.length === 0 && (
                <p className="text-sm font-mono text-white/40 text-center py-8">No custom action items yet. Add one above.</p>
              )}
            </div>
          </motion.section>

          {/* ===== SECTION 6: HERMES INSIGHTS ===== */}
          <motion.section
            id="section-insights"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.2, ease: 'easeOut' }}
            className="glass-static p-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-[#A855F7]" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[22px] font-heading font-bold text-white leading-tight">Hermes Insights</h2>
                <p className="text-[13px] font-mono text-white/50 mt-0.5">AI-generated meeting analysis</p>
              </div>
            </div>

            {insights ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <InsightCard label="Sentiment" value={insights.sentiment} icon={Heart} color="#00E676" />
                <InsightCard label="Deal Probability" value={insights.deal_probability} icon={TrendingUp} color="#00BFFF" />
                <InsightCard label="Follow-up Urgency" value={insights.followup_urgency} icon={AlertCircle} color="#FF6B35" />
                <InsightCard label="Decision Makers" value={insights.decision_makers?.join(', ')} icon={Users} color="#A855F7" />
                <InsightCard label="Pricing Discussed" value={insights.pricing_discussed ? 'Yes' : 'No'} icon={DollarSign} color="#F59E0B" />
                <InsightCard label="Next Steps" value={insights.next_steps} icon={ArrowRight} color="#00BFFF" />
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="p-5 rounded-xl bg-white/[0.01] border border-white/[0.05]">
                    <div className="w-20 h-3 rounded bg-white/[0.06] animate-pulse mb-4" />
                    <div className="w-28 h-5 rounded bg-white/[0.04] animate-pulse" />
                  </div>
                ))}
                <p className="col-span-full text-sm font-mono text-white/40 text-center mt-4">
                  Hermes will analyze this meeting soon...
                </p>
              </div>
            )}
          </motion.section>

          {/* ===== SECTION 7: FEEDBACK & NOTES ===== */}
          <MeetingFeedback meetingId={id} insights={insights} />

          {/* ===== SECTION 8: TRANSCRIPT ===== */}
          <motion.section
            id="section-transcript"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.2, ease: 'easeOut' }}
            className="glass-static p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00BFFF]/10 border border-[#00BFFF]/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-[#00BFFF]" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-[22px] font-heading font-bold text-white leading-tight">Transcript</h2>
                  <p className="text-[13px] font-mono text-white/50 mt-0.5">{transcript.length} entries</p>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" strokeWidth={1.5} />
                <input
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  placeholder="Search transcript..."
                  className="pl-11 pr-5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#00BFFF]/30 w-64 transition-all duration-150"
                />
              </div>
            </div>

            <div className="space-y-5 max-h-[700px] overflow-y-auto pr-2">
              {filteredTranscript.length > 0 ? filteredTranscript.map((entry, i) => {
                const speakerName = entry.speaker?.display_name || 'Unknown'
                const color = getSpeakerColor(speakerName)
                const initials = getInitials(speakerName)

                return (
                  <div key={i} className="flex gap-4 group">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-mono font-bold mt-1"
                      style={{ background: `${color}15`, color }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-mono font-semibold" style={{ color }}>
                          {speakerName}
                        </span>
                        <span className="text-xs font-mono text-white/30">{entry.timestamp}</span>
                      </div>
                      <p className="text-base font-body text-white/75 leading-relaxed">
                        {transcriptSearch ? highlightText(entry.text, transcriptSearch) : entry.text}
                      </p>
                    </div>
                  </div>
                )
              }) : (
                <p className="text-base font-mono text-white/40 text-center py-12">
                  {transcriptSearch ? 'No matches found.' : 'No transcript available.'}
                </p>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </motion.div>
  )
}

function highlightText(text, query) {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-[#00BFFF]/20 text-[#00BFFF] rounded px-0.5">{part}</mark>
      : part
  )
}
