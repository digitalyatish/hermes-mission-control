import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Brain, Sparkles, Search, ChevronDown, ChevronUp, X,
  GitBranch, Zap, Tag, Clock, Hash, Filter, BookOpen, Activity,
  Link2, Video, FileText, Type, Upload, Check, Loader2, Pencil, XCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const SOURCE_STYLES = {
  builtin: { bg: 'bg-white/[0.06]', text: 'text-white/50', border: 'border-white/10', label: 'Built-in' },
  custom: { bg: 'bg-[#00BFFF]/10', text: 'text-[#00BFFF]', border: 'border-[#00BFFF]/20', label: 'Custom' },
  learned: { bg: 'bg-[#00E676]/10', text: 'text-[#00E676]', border: 'border-[#00E676]/20', label: 'Learned' },
}

const CHANGE_STYLES = {
  created: { color: '#00E676', label: 'Created' },
  patched: { color: '#F59E0B', label: 'Patched' },
  major_update: { color: '#00BFFF', label: 'Major Update' },
  deprecated: { color: '#FF3D00', label: 'Deprecated' },
}

const CATEGORY_COLORS = ['#00BFFF', '#FF6B35', '#00E676', '#A855F7', '#F59E0B', '#EC4899', '#14B8A6']

function getCategoryColor(cat) {
  let hash = 0
  for (let i = 0; i < (cat || '').length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash)
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Skills() {
  const [tab, setTab] = useState('skills')
  const [skills, setSkills] = useState([])
  const [changelog, setChangelog] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [expandedSkill, setExpandedSkill] = useState(null)
  const [skillChanges, setSkillChanges] = useState({})

  useEffect(() => {
    async function load() {
      const [skillsRes, changelogRes, statsRes] = await Promise.all([
        supabase.from('agent_skills').select('*').order('updated_at', { ascending: false }),
        supabase.from('skill_changelog').select('*').order('created_at', { ascending: false }).limit(50),
        // stats: compute client-side
        supabase.from('agent_skills').select('id, name, source, category'),
      ])
      setSkills(skillsRes.data || [])

      // Enrich changelog with skill names
      const skillMap = {}
      ;(statsRes.data || []).forEach(s => { skillMap[s.id] = s })
      const enriched = (changelogRes.data || []).map(c => ({
        ...c,
        skill_name: skillMap[c.skill_id]?.name || 'Unknown',
        skill_category: skillMap[c.skill_id]?.category || '',
      }))
      setChangelog(enriched)

      // Stats
      const allSkills = statsRes.data || []
      const bySource = {}; const byCategory = {}
      allSkills.forEach(s => {
        bySource[s.source] = (bySource[s.source] || 0) + 1
        byCategory[s.category] = (byCategory[s.category] || 0) + 1
      })
      setStats({ total: allSkills.length, bySource, byCategory, totalChanges: changelogRes.data?.length || 0 })
      setLoading(false)
    }
    load()
  }, [])

  async function loadSkillChanges(skillId) {
    if (skillChanges[skillId]) return
    const { data } = await supabase
      .from('skill_changelog')
      .select('*')
      .eq('skill_id', skillId)
      .order('created_at', { ascending: false })
      .limit(20)
    setSkillChanges(prev => ({ ...prev, [skillId]: data || [] }))
  }

  function toggleExpand(skillId) {
    if (expandedSkill === skillId) {
      setExpandedSkill(null)
    } else {
      setExpandedSkill(skillId)
      loadSkillChanges(skillId)
    }
  }

  const filteredSkills = skills.filter(s => {
    if (sourceFilter !== 'all' && s.source !== sourceFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-2 border-[#00BFFF]/30 border-t-[#00BFFF] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-[1400px] mx-auto space-y-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-heading font-bold tracking-wide text-white leading-tight neon-text">Agent Skills</h1>
          <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#A855F7] to-transparent" />
          <p className="mt-4 text-[15px] font-body text-white/50">Hermes' evolving knowledge base</p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex flex-wrap gap-6">
          {[
            { label: 'Total Skills', value: stats.total, color: '#A855F7' },
            { label: 'Custom', value: stats.bySource.custom || 0, color: '#00BFFF' },
            { label: 'Learned', value: stats.bySource.learned || 0, color: '#00E676' },
            { label: 'Changes', value: stats.totalChanges, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
              <span className="text-2xl font-heading font-bold text-white">{s.value}</span>
              <span className="text-[13px] font-mono text-white/40">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'skills', label: 'All Skills', icon: Brain },
          { key: 'changelog', label: 'Changelog', icon: GitBranch },
          { key: 'builder', label: 'Skill Builder', icon: Sparkles },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-mono font-medium transition-all duration-150 border ${
              tab === t.key
                ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20'
                : 'text-white/50 border-white/[0.08] hover:text-white/70 bg-white/[0.02]'
            }`}
          >
            <t.icon size={16} strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SKILLS TAB ── */}
      {tab === 'skills' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search skills..."
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#A855F7]/30 transition-all duration-150"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'builtin', 'custom', 'learned'].map(f => (
                <button
                  key={f}
                  onClick={() => setSourceFilter(f)}
                  className={`px-4 py-3 rounded-xl text-sm font-mono transition-all duration-150 border ${
                    sourceFilter === f
                      ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20'
                      : 'text-white/50 border-white/[0.08] hover:text-white/70 bg-white/[0.02]'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Skills Grid */}
          {filteredSkills.length === 0 ? (
            <div className="text-center py-20 glass-static rounded-xl">
              <Brain size={40} className="text-white/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-mono text-base text-white/40 mb-2">No skills synced yet</p>
              <p className="font-body text-sm text-white/25">The agent will populate this automatically</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSkills.map((skill, i) => {
                const src = SOURCE_STYLES[skill.source] || SOURCE_STYLES.builtin
                const catColor = getCategoryColor(skill.category)
                const isExpanded = expandedSkill === skill.id
                const changes = skillChanges[skill.id] || []

                return (
                  <motion.div
                    key={skill.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                    className={`glass-static overflow-hidden transition-all duration-150 ${isExpanded ? 'col-span-1 md:col-span-2 xl:col-span-3' : ''}`}
                  >
                    {/* Card header */}
                    <button
                      onClick={() => toggleExpand(skill.id)}
                      className="w-full text-left p-6 hover:bg-white/[0.01] transition-all duration-150"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase border"
                            style={{ color: catColor, background: `${catColor}15`, borderColor: `${catColor}33` }}>
                            {skill.category}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase border ${src.bg} ${src.text} ${src.border}`}>
                            {src.label}
                          </span>
                        </div>
                        <span className="text-[12px] font-mono text-white/30">v{skill.version}</span>
                      </div>

                      <h3 className="text-base font-body font-semibold text-white/90 mb-1.5">{skill.name}</h3>
                      {skill.description && (
                        <p className="text-sm font-body text-white/50 leading-relaxed line-clamp-2">{skill.description}</p>
                      )}

                      <div className="flex items-center gap-4 mt-3">
                        {skill.tags?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {skill.tags.slice(0, 3).map(t => (
                              <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/30 bg-white/[0.03]">{t}</span>
                            ))}
                            {skill.tags.length > 3 && <span className="text-[10px] font-mono text-white/20">+{skill.tags.length - 3}</span>}
                          </div>
                        )}
                        <span className="text-[11px] font-mono text-white/25 ml-auto">{timeAgo(skill.updated_at)}</span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="border-t border-white/[0.06] p-6 space-y-5"
                      >
                        {skill.trigger_pattern && (
                          <div>
                            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider mb-1">Trigger Pattern</p>
                            <p className="text-sm font-mono text-[#00BFFF]/70 bg-[#00BFFF]/5 px-3 py-2 rounded-lg inline-block">{skill.trigger_pattern}</p>
                          </div>
                        )}

                        {skill.skill_metadata && Object.keys(skill.skill_metadata).length > 0 && (
                          <div>
                            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider mb-2">Metadata</p>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(skill.skill_metadata).map(([k, v]) => (
                                <div key={k} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                                  <p className="text-[11px] font-mono text-white/40">{k}</p>
                                  <p className="text-sm font-body text-white/70 mt-0.5">{String(v)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Changelog */}
                        <div>
                          <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider mb-2">Recent Changes</p>
                          {changes.length === 0 ? (
                            <p className="text-sm font-mono text-white/25">No changes logged yet</p>
                          ) : (
                            <div className="space-y-2">
                              {changes.map(c => {
                                const style = CHANGE_STYLES[c.change_type] || CHANGE_STYLES.patched
                                return (
                                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.01]">
                                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: style.color }} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-mono tracking-wider uppercase" style={{ color: style.color }}>{style.label}</span>
                                        <span className="text-[11px] font-mono text-white/25">{timeAgo(c.created_at)}</span>
                                        {c.triggered_by && <span className="text-[10px] font-mono text-white/20">via {c.triggered_by}</span>}
                                      </div>
                                      <p className="text-sm font-body text-white/60 leading-relaxed">{c.change_summary}</p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── CHANGELOG TAB ── */}
      {tab === 'changelog' && (
        <div className="space-y-2">
          {changelog.length === 0 ? (
            <div className="text-center py-20 glass-static rounded-xl">
              <GitBranch size={40} className="text-white/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-mono text-base text-white/40">No changes logged yet</p>
            </div>
          ) : (
            changelog.map((c, i) => {
              const style = CHANGE_STYLES[c.change_type] || CHANGE_STYLES.patched
              const catColor = getCategoryColor(c.skill_category)
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.2 }}
                  className="flex items-start gap-4 p-5 glass-static"
                >
                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: style.color, boxShadow: `0 0 8px ${style.color}50` }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <span className="text-base font-body font-semibold text-white/80">{c.skill_name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase"
                        style={{ color: catColor, background: `${catColor}15` }}>
                        {c.skill_category}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase"
                        style={{ color: style.color, background: `${style.color}15` }}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-sm font-body text-white/60 leading-relaxed">{c.change_summary}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] font-mono text-white/25">{timeAgo(c.created_at)}</span>
                      {c.triggered_by && <span className="text-[11px] font-mono text-white/20">via {c.triggered_by}</span>}
                      {c.meeting_id && (
                        <Link to={`/meetings/${c.meeting_id}`} className="text-[11px] font-mono text-[#00BFFF]/50 hover:text-[#00BFFF] transition-colors">
                          View meeting
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      )}

      {/* ── SKILL BUILDER TAB ── */}
      {tab === 'builder' && <SkillBuilderTab />}
    </motion.div>
  )
}

// ── Skill Builder Tab Component ──
const INPUT_TYPES = [
  { key: 'url', label: 'URL', icon: Link2, placeholder: 'https://docs.example.com/api-reference' },
  { key: 'youtube', label: 'YouTube', icon: Video, placeholder: 'https://www.youtube.com/watch?v=...' },
  { key: 'article', label: 'Article', icon: FileText, placeholder: 'Paste a blog post or docs URL' },
  { key: 'raw_text', label: 'Raw Text', icon: Type, placeholder: '' },
]

const PROPOSAL_STATUS = {
  pending: { color: '#F59E0B', label: 'Pending', icon: '\u23F3' },
  approved: { color: '#00E676', label: 'Approved', icon: '\u2705' },
  rejected: { color: '#FF3D00', label: 'Rejected', icon: '\u274C' },
  edited: { color: '#00BFFF', label: 'Edited', icon: '\u270F\uFE0F' },
}

function SkillBuilderTab() {
  const [inputType, setInputType] = useState('url')
  const [inputUrl, setInputUrl] = useState('')
  const [inputText, setInputText] = useState('')
  const [inputTitle, setInputTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [expandedSub, setExpandedSub] = useState(null)
  const [proposals, setProposals] = useState({})
  const [reviewNotes, setReviewNotes] = useState({})
  const [loading, setLoading] = useState(true)

  async function loadSubmissions() {
    const { data } = await supabase.from('skill_submissions').select('*').order('created_at', { ascending: false }).limit(20)
    setSubmissions(data || [])

    // Load proposal counts
    const ids = (data || []).map(s => s.id)
    if (ids.length) {
      const { data: props } = await supabase.from('skill_proposals').select('submission_id, status').in('submission_id', ids)
      const counts = {}
      for (const p of (props || [])) {
        if (!counts[p.submission_id]) counts[p.submission_id] = { total: 0, approved: 0, pending: 0, rejected: 0 }
        counts[p.submission_id].total++
        counts[p.submission_id][p.status] = (counts[p.submission_id][p.status] || 0) + 1
      }
      setSubmissions(prev => prev.map(s => ({ ...s, _counts: counts[s.id] || { total: 0, approved: 0, pending: 0 } })))
    }
    setLoading(false)
  }

  useEffect(() => { loadSubmissions() }, [])

  async function handleSubmit() {
    setSubmitting(true)
    const params = { input_type: inputType, input_title: inputTitle || undefined }
    if (inputType === 'raw_text') {
      params.input_text = inputText
    } else {
      params.input_url = inputUrl
    }

    await supabase.from('skill_submissions').insert({
      ...params,
      extracted_content: inputType === 'raw_text' ? inputText : null,
      extraction_status: inputType === 'raw_text' ? 'extracted' : 'pending',
    })

    setInputUrl('')
    setInputText('')
    setInputTitle('')
    setSubmitting(false)
    loadSubmissions()
  }

  async function loadProposals(subId) {
    if (expandedSub === subId) { setExpandedSub(null); return }
    setExpandedSub(subId)
    if (proposals[subId]) return
    const { data } = await supabase.from('skill_proposals').select('*').eq('submission_id', subId).order('created_at')
    setProposals(prev => ({ ...prev, [subId]: data || [] }))
  }

  async function handleApprove(propId) {
    await supabase.from('skill_proposals').update({ status: 'approved', reviewer_notes: reviewNotes[propId] || null, created_skill_name: proposals[expandedSub]?.find(p => p.id === propId)?.skill_name }).eq('id', propId)
    const updated = { ...proposals }
    if (updated[expandedSub]) updated[expandedSub] = updated[expandedSub].map(p => p.id === propId ? { ...p, status: 'approved' } : p)
    setProposals(updated)
    loadSubmissions()
  }

  async function handleReject(propId) {
    await supabase.from('skill_proposals').update({ status: 'rejected', reviewer_notes: reviewNotes[propId] || null }).eq('id', propId)
    const updated = { ...proposals }
    if (updated[expandedSub]) updated[expandedSub] = updated[expandedSub].map(p => p.id === propId ? { ...p, status: 'rejected' } : p)
    setProposals(updated)
    loadSubmissions()
  }

  return (
    <div className="space-y-8">
      {/* Input Area */}
      <div className="glass-static" style={{ padding: 32 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
            <Sparkles size={16} className="text-[#A855F7]" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-white">Extract Skills from Any Source</h3>
            <p className="text-[13px] font-mono text-white/40">Paste a URL, YouTube link, or raw text</p>
          </div>
        </div>

        {/* Input type tabs */}
        <div className="flex gap-2 mb-4">
          {INPUT_TYPES.map(t => (
            <button key={t.key} onClick={() => setInputType(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono transition-all border ${
                inputType === t.key ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20' : 'text-white/40 border-white/[0.06] hover:text-white/60 bg-white/[0.02]'
              }`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <input value={inputTitle} onChange={e => setInputTitle(e.target.value)}
          placeholder="Title (optional — auto-detected from URL)"
          className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-base font-body text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#A855F7]/30 mb-3 transition-all" />

        {/* Input field */}
        {inputType === 'raw_text' ? (
          <div>
            <textarea value={inputText} onChange={e => setInputText(e.target.value)}
              placeholder="Paste any content — documentation, notes, instructions, workflows, API reference..."
              className="w-full h-40 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-base font-body text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#A855F7]/30 resize-y transition-all leading-relaxed" />
            <p className="text-[11px] font-mono text-white/25 mt-1 text-right">{inputText.length} chars</p>
          </div>
        ) : (
          <input value={inputUrl} onChange={e => setInputUrl(e.target.value)}
            placeholder={INPUT_TYPES.find(t => t.key === inputType)?.placeholder}
            className="w-full px-4 py-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-base font-mono text-white/70 placeholder:text-white/25 focus:outline-none focus:border-[#A855F7]/30 transition-all" />
        )}

        <button onClick={handleSubmit}
          disabled={submitting || (inputType === 'raw_text' ? !inputText.trim() : !inputUrl.trim())}
          className="w-full mt-4 flex items-center justify-center gap-3 py-4 rounded-xl bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20 text-base font-mono font-semibold hover:bg-[#A855F7]/20 transition-all disabled:opacity-30">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {submitting ? 'Submitting...' : inputType === 'raw_text' ? 'Analyze' : 'Extract & Analyze'}
        </button>
      </div>

      {/* Submissions Queue */}
      {loading ? (
        <div className="text-center py-8"><Loader2 size={24} className="text-[#A855F7] animate-spin mx-auto" /></div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 glass-static rounded-xl">
          <Sparkles size={40} className="text-white/15 mx-auto mb-3" />
          <p className="font-mono text-base text-white/40">No submissions yet</p>
          <p className="font-body text-sm text-white/25">Paste a URL or text above to extract skills</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => {
            const counts = sub._counts || { total: 0, approved: 0, pending: 0 }
            const isExpanded = expandedSub === sub.id
            const subProposals = proposals[sub.id] || []

            return (
              <div key={sub.id} className="glass-static overflow-hidden">
                <button onClick={() => loadProposals(sub.id)} className="w-full text-left p-6 hover:bg-white/[0.01] transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {sub.input_type === 'youtube' ? <Video size={16} className="text-[#FF3D00]" /> :
                       sub.input_type === 'raw_text' ? <Type size={16} className="text-[#A855F7]" /> :
                       <Link2 size={16} className="text-[#00BFFF]" />}
                      <span className="text-base font-body font-semibold text-white/90">{sub.input_title || sub.input_url || 'Raw Text Submission'}</span>
                    </div>
                    <span className="text-[12px] font-mono text-white/25">{timeAgo(sub.created_at)}</span>
                  </div>
                  {sub.input_url && <p className="text-[13px] font-mono text-white/30 mb-2 truncate">{sub.input_url}</p>}

                  {/* Status */}
                  <div className="flex items-center gap-3 text-[13px] font-mono">
                    {sub.extraction_status === 'pending' && <span className="text-[#F59E0B]">\u23F3 Extracting...</span>}
                    {sub.extraction_status === 'failed' && <span className="text-[#FF3D00]">\u274C Extraction failed</span>}
                    {sub.processing_status === 'processing' && <span className="text-[#F59E0B]">\u23F3 AI Analyzing...</span>}
                    {sub.processing_status === 'completed' && <span className="text-[#00E676]">\u2705 Ready for review</span>}

                    {counts.total > 0 && (
                      <span className="text-white/30">
                        {counts.approved > 0 && <span className="text-[#00E676]">\u2705 {counts.approved} </span>}
                        {counts.pending > 0 && <span className="text-[#F59E0B]">\u23F3 {counts.pending} </span>}
                        proposals
                      </span>
                    )}
                  </div>

                  {sub.processing_notes && <p className="text-sm font-body text-white/40 mt-2">{sub.processing_notes}</p>}
                </button>

                {/* Expanded: Proposals */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-6 space-y-4">
                    {subProposals.length === 0 ? (
                      <p className="text-sm font-mono text-white/30 text-center py-4">
                        {sub.processing_status === 'completed' ? 'No proposals generated yet' : 'AI is still processing...'}
                      </p>
                    ) : (
                      subProposals.map(prop => {
                        const pst = PROPOSAL_STATUS[prop.status] || PROPOSAL_STATUS.pending
                        return (
                          <div key={prop.id} className={`p-5 rounded-xl border ${prop.status === 'rejected' ? 'bg-white/[0.01] border-white/[0.04] opacity-50' : 'bg-white/[0.02] border-white/[0.08]'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-mono font-semibold text-white/90">{prop.skill_name}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase"
                                  style={{ color: pst.color, background: `${pst.color}15` }}>{pst.icon} {pst.label}</span>
                              </div>
                              <span className="text-[12px] font-mono text-white/25">v{prop.skill_version}</span>
                            </div>

                            <p className="text-sm font-body text-white/60 mb-2">{prop.skill_description}</p>

                            {prop.skill_tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {prop.skill_tags.map(t => (
                                  <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/30 bg-white/[0.03]">{t}</span>
                                ))}
                              </div>
                            )}

                            {/* Skill content preview */}
                            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] max-h-[200px] overflow-y-auto mb-4">
                              <pre className="text-[12px] font-mono text-white/40 whitespace-pre-wrap leading-relaxed">{prop.edited_content || prop.skill_content}</pre>
                            </div>

                            {/* Actions */}
                            {prop.status === 'pending' && (
                              <div className="space-y-3">
                                <input value={reviewNotes[prop.id] || ''} onChange={e => setReviewNotes(prev => ({ ...prev, [prop.id]: e.target.value }))}
                                  placeholder="Notes (optional)"
                                  className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-sm font-body text-white/60 placeholder:text-white/20 focus:outline-none" />
                                <div className="flex gap-2">
                                  <button onClick={() => handleApprove(prop.id)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-sm font-mono hover:bg-[#00E676]/20 transition-all">
                                    <Check size={14} /> Approve
                                  </button>
                                  <button onClick={() => handleReject(prop.id)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF3D00]/10 text-[#FF3D00] border border-[#FF3D00]/20 text-sm font-mono hover:bg-[#FF3D00]/20 transition-all">
                                    <XCircle size={14} /> Reject
                                  </button>
                                </div>
                              </div>
                            )}

                            {prop.reviewer_notes && (
                              <p className="text-[12px] font-mono text-white/30 mt-2 italic">Review: {prop.reviewer_notes}</p>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
