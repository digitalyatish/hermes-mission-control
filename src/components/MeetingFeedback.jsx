import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ThumbsUp, ThumbsDown, Pencil, MessageCircle, Bot, User,
  Send, ChevronDown, ChevronUp, Sparkles, X, Check, Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const FEEDBACK_COLORS = {
  rating: '#F59E0B',
  correction: '#FF6B35',
  context: '#00BFFF',
  note: '#A855F7',
  action_request: '#00E676',
}

const FEEDBACK_LABELS = {
  rating: 'Rating',
  correction: 'Correction',
  context: 'Context',
  note: 'Note',
  action_request: 'Request',
}

const ACTION_REQUESTS = [
  'Re-analyze this meeting',
  'Draft a follow-up email',
  'Draft a proposal',
  'Find similar meetings',
]

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function MeetingFeedback({ meetingId, insights }) {
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [sending, setSending] = useState(false)
  const [showRatingReason, setShowRatingReason] = useState(false)
  const [ratingReason, setRatingReason] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [contextText, setContextText] = useState('')
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [customAction, setCustomAction] = useState('')
  const [editingField, setEditingField] = useState(null)
  const [correctionValue, setCorrectionValue] = useState('')
  const [correctionWhy, setCorrectionWhy] = useState('')

  async function loadFeedback() {
    const { data } = await supabase
      .from('meeting_feedback')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
    setFeedback(data || [])
    setLoading(false)
  }

  useEffect(() => { loadFeedback() }, [meetingId])

  const unreadCount = feedback.filter(f => f.source === 'agent' && !f.is_read).length

  async function submitFeedback(type, content, metadata = {}) {
    setSending(true)
    await supabase.from('meeting_feedback').insert({
      meeting_id: meetingId,
      source: 'user',
      feedback_type: type,
      content,
      metadata,
    })

    // Auto-tag
    const { data: mtg } = await supabase.from('fathom_meetings').select('tags').eq('id', meetingId).single()
    const tags = Array.isArray(mtg?.tags) ? mtg.tags : []
    if (!tags.includes('has_feedback')) {
      tags.push('has_feedback')
      await supabase.from('fathom_meetings').update({ tags }).eq('id', meetingId)
    }

    setSending(false)
    loadFeedback()
  }

  async function handleRating(rating) {
    if (rating === 'down') {
      setShowRatingReason(true)
      return
    }
    await submitFeedback('rating', 'Insights look good', { rating: 'up' })
  }

  async function submitDownRating() {
    await submitFeedback('rating', ratingReason || 'Needs improvement', { rating: 'down', reason: ratingReason })
    setShowRatingReason(false)
    setRatingReason('')
  }

  async function submitContext() {
    if (!contextText.trim()) return
    await submitFeedback('context', contextText.trim())
    setContextText('')
    setShowContext(false)
  }

  async function submitNote() {
    if (!newNote.trim()) return
    await submitFeedback('note', newNote.trim())
    setNewNote('')
  }

  async function submitAction(action) {
    await submitFeedback('action_request', action)
    setShowActionMenu(false)
    setCustomAction('')
  }

  async function submitCorrection() {
    if (!correctionValue.trim()) return
    const insightObj = insights || {}
    await submitFeedback('correction', correctionWhy || `Suggested change for ${editingField}`, {
      field: editingField,
      old_value: insightObj[editingField] || 'N/A',
      suggested_value: correctionValue,
    })
    setEditingField(null)
    setCorrectionValue('')
    setCorrectionWhy('')
  }

  const hasRated = feedback.some(f => f.feedback_type === 'rating')

  return (
    <motion.section
      id="section-feedback"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.2, ease: 'easeOut' }}
      className="glass-static overflow-hidden"
    >
      {/* Header — collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-8 hover:bg-white/[0.01] transition-all duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
            <MessageCircle size={16} className="text-[#F59E0B]" strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <h2 className="text-[22px] font-heading font-bold text-white leading-tight">Feedback & Notes</h2>
            <p className="text-[13px] font-mono text-white/40 mt-0.5">Communicate with Hermes about this meeting</p>
          </div>
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-[#00BFFF]/10 border border-[#00BFFF]/20 text-[11px] font-mono text-[#00BFFF] font-semibold">
              {unreadCount} new
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} className="text-white/30" /> : <ChevronDown size={18} className="text-white/30" />}
      </button>

      {expanded && (
        <div className="px-8 pb-8 space-y-6">
          {/* ── Insight Rating ── */}
          {!hasRated && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-sm font-body text-white/60">How are the insights?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRating('up')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676] text-sm font-mono hover:bg-[#00E676]/20 transition-all duration-150"
                >
                  <ThumbsUp size={14} /> Good
                </button>
                <button
                  onClick={() => handleRating('down')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF3D00]/10 border border-[#FF3D00]/20 text-[#FF3D00] text-sm font-mono hover:bg-[#FF3D00]/20 transition-all duration-150"
                >
                  <ThumbsDown size={14} /> Needs work
                </button>
              </div>
            </div>
          )}

          {showRatingReason && (
            <div className="p-4 rounded-xl bg-[#FF3D00]/5 border border-[#FF3D00]/20 space-y-3">
              <p className="text-sm font-body text-white/60">What did Hermes get wrong?</p>
              <input
                value={ratingReason}
                onChange={e => setRatingReason(e.target.value)}
                placeholder="e.g. Missed key objection about timeline"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#FF3D00]/30 transition-all duration-150"
                onKeyDown={e => e.key === 'Enter' && submitDownRating()}
              />
              <div className="flex gap-2">
                <button onClick={submitDownRating} className="px-4 py-2 rounded-lg bg-[#FF3D00]/10 text-[#FF3D00] border border-[#FF3D00]/20 text-sm font-mono hover:bg-[#FF3D00]/20 transition-all">Submit</button>
                <button onClick={() => setShowRatingReason(false)} className="px-4 py-2 rounded-lg bg-white/[0.03] text-white/40 border border-white/[0.06] text-sm font-mono hover:text-white/60 transition-all">Cancel</button>
              </div>
            </div>
          )}

          {/* ── Correction Cards (when insights exist) ── */}
          {insights && (
            <div>
              <p className="text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase mb-3">Correct Insights</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(insights).filter(([k]) => !['decision_makers'].includes(k)).map(([field, value]) => (
                  <div key={field} className="relative group">
                    {editingField === field ? (
                      <div className="p-3 rounded-xl bg-[#FF6B35]/5 border border-[#FF6B35]/20 space-y-2">
                        <p className="text-[11px] font-mono text-white/40 uppercase">{field.replace(/_/g, ' ')}</p>
                        <input
                          value={correctionValue}
                          onChange={e => setCorrectionValue(e.target.value)}
                          placeholder="Suggested value"
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm font-body text-white/80 placeholder:text-white/25 focus:outline-none"
                        />
                        <input
                          value={correctionWhy}
                          onChange={e => setCorrectionWhy(e.target.value)}
                          placeholder="Why? (optional)"
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm font-body text-white/60 placeholder:text-white/25 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={submitCorrection} className="px-3 py-1.5 rounded-lg bg-[#FF6B35]/10 text-[#FF6B35] text-xs font-mono hover:bg-[#FF6B35]/20 transition-all"><Check size={12} /></button>
                          <button onClick={() => setEditingField(null)} className="px-3 py-1.5 rounded-lg bg-white/[0.03] text-white/40 text-xs font-mono hover:text-white/60 transition-all"><X size={12} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-mono text-white/40 uppercase">{field.replace(/_/g, ' ')}</p>
                          <button
                            onClick={() => { setEditingField(field); setCorrectionValue(''); setCorrectionWhy('') }}
                            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-[#FF6B35] transition-all"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                        <p className="text-sm font-body text-white/70 mt-1">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Context Box ── */}
          {!showContext ? (
            <button
              onClick={() => setShowContext(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm font-mono text-white/40 hover:text-white/60 hover:border-white/[0.1] transition-all duration-150"
            >
              <Sparkles size={14} /> Add context Hermes didn't have
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={contextText}
                onChange={e => setContextText(e.target.value)}
                placeholder="e.g. This prospect was referred by Brian, budget is pre-approved, they're evaluating 2 other vendors..."
                className="w-full h-24 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#00BFFF]/30 resize-y transition-all leading-relaxed"
              />
              <div className="flex gap-2">
                <button onClick={submitContext} disabled={sending} className="px-4 py-2 rounded-lg bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-sm font-mono hover:bg-[#00BFFF]/20 transition-all">Add Context</button>
                <button onClick={() => { setShowContext(false); setContextText('') }} className="px-4 py-2 rounded-lg bg-white/[0.03] text-white/40 border border-white/[0.06] text-sm font-mono hover:text-white/60 transition-all">Cancel</button>
              </div>
            </div>
          )}

          {/* ── Action Request ── */}
          <div className="relative">
            <button
              onClick={() => setShowActionMenu(!showActionMenu)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 text-sm font-mono text-[#00E676] hover:bg-[#00E676]/20 transition-all duration-150"
            >
              <Bot size={14} /> Ask Hermes to...
              <ChevronDown size={14} />
            </button>
            {showActionMenu && (
              <div className="absolute top-12 left-0 z-20 w-80 p-2 rounded-xl glass-static border border-white/[0.1] shadow-xl">
                {ACTION_REQUESTS.map(action => (
                  <button
                    key={action}
                    onClick={() => submitAction(action)}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm font-body text-white/70 hover:bg-white/[0.04] hover:text-white transition-all duration-150"
                  >
                    {action}
                  </button>
                ))}
                <div className="border-t border-white/[0.06] mt-1 pt-1">
                  <div className="flex gap-2 px-2 py-1">
                    <input
                      value={customAction}
                      onChange={e => setCustomAction(e.target.value)}
                      placeholder="Custom request..."
                      className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm font-body text-white/70 placeholder:text-white/25 focus:outline-none"
                      onKeyDown={e => e.key === 'Enter' && customAction.trim() && submitAction(customAction.trim())}
                    />
                    <button
                      onClick={() => customAction.trim() && submitAction(customAction.trim())}
                      className="px-3 py-2 rounded-lg bg-[#00E676]/10 text-[#00E676] hover:bg-[#00E676]/20 transition-all"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Notes Thread ── */}
          {feedback.length > 0 && (
            <div>
              <p className="text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase mb-3">Thread</p>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {feedback.map((f) => {
                  const isAgent = f.source === 'agent'
                  const color = FEEDBACK_COLORS[f.feedback_type] || '#A855F7'
                  return (
                    <div key={f.id} className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isAgent ? 'bg-[#00BFFF]/15' : 'bg-[#A855F7]/15'}`}>
                        {isAgent ? <Bot size={14} className="text-[#00BFFF]" /> : <User size={14} className="text-[#A855F7]" />}
                      </div>
                      <div className={`flex-1 max-w-[85%] p-4 rounded-xl ${isAgent ? 'bg-[#00BFFF]/5 border border-[#00BFFF]/10' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase" style={{ background: `${color}15`, color }}>
                            {FEEDBACK_LABELS[f.feedback_type] || f.feedback_type}
                          </span>
                          <span className="text-[11px] font-mono text-white/25">{timeAgo(f.created_at)}</span>
                        </div>
                        <p className="text-sm font-body text-white/70 leading-relaxed">{f.content}</p>
                        {f.metadata && f.feedback_type === 'correction' && f.metadata.field && (
                          <div className="mt-2 flex items-center gap-2 text-[12px] font-mono text-white/40">
                            <span>{f.metadata.field}:</span>
                            <span className="text-[#FF3D00] line-through">{f.metadata.old_value}</span>
                            <span className="text-white/20">&rarr;</span>
                            <span className="text-[#00E676]">{f.metadata.suggested_value}</span>
                          </div>
                        )}
                        {f.metadata?.actions_taken && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {f.metadata.actions_taken.map((a, i) => (
                              <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#00E676]/10 text-[#00E676]/70">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── New note input ── */}
          <div className="flex gap-3">
            <input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitNote()}
              placeholder="Add a note..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]/30 transition-all duration-150"
            />
            <button
              onClick={submitNote}
              disabled={!newNote.trim() || sending}
              className="px-4 py-3 rounded-xl bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20 hover:bg-[#A855F7]/20 transition-all disabled:opacity-40"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </motion.section>
  )
}
