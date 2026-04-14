import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Radio, Copy, Check, Eye, EyeOff, Trash2, Pause, Play,
  Code2, Plus, ChevronUp, ChevronDown, Power, Clock, Zap, AlertCircle
} from 'lucide-react'
import { getWebhook, getWebhookEvents, getWebhookFunctions, updateWebhookStatus, deleteWebhook, createFunction, updateFunction, deleteFunction, reorderFunctions } from '../lib/webhooks'
import FunctionEditor from '../components/FunctionEditor'

export default function WebhookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [webhook, setWebhook] = useState(null)
  const [events, setEvents] = useState([])
  const [functions, setFunctions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSecret, setShowSecret] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [showFunctionEditor, setShowFunctionEditor] = useState(false)
  const [editingFunction, setEditingFunction] = useState(null)
  const [expandedEvent, setExpandedEvent] = useState(null)

  async function load() {
    const [{ data: wh }, { data: ev }, { data: fn }] = await Promise.all([
      getWebhook(id),
      getWebhookEvents(id),
      getWebhookFunctions(id),
    ])
    setWebhook(wh)
    setEvents(ev || [])
    setFunctions(fn || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function copyToClipboard(text, setter) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  async function handleToggleStatus() {
    const newStatus = webhook.status === 'active' ? 'paused' : 'active'
    await updateWebhookStatus(id, newStatus)
    setWebhook({ ...webhook, status: newStatus })
  }

  async function handleDelete() {
    if (!confirm('Delete this webhook and all its functions? This cannot be undone.')) return
    await deleteWebhook(id)
    navigate('/webhooks')
  }

  async function handleSaveFunction(data) {
    if (editingFunction?.id) {
      await updateFunction(editingFunction.id, data)
    } else {
      await createFunction(id, data)
    }
    setShowFunctionEditor(false)
    setEditingFunction(null)
    load()
  }

  async function handleDeleteFunction(fnId) {
    if (!confirm('Delete this function?')) return
    await deleteFunction(fnId)
    load()
  }

  async function handleToggleFunction(fn) {
    await updateFunction(fn.id, { is_active: !fn.is_active })
    load()
  }

  async function handleMoveFunction(index, direction) {
    const newFunctions = [...functions]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= newFunctions.length) return
    ;[newFunctions[index], newFunctions[targetIndex]] = [newFunctions[targetIndex], newFunctions[index]]
    setFunctions(newFunctions)
    await reorderFunctions(id, newFunctions.map(f => f.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-2 border-[#00BFFF]/30 border-t-[#00BFFF] rounded-full animate-spin" />
      </div>
    )
  }

  if (!webhook) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-base text-white/50">Webhook not found</p>
        <Link to="/webhooks" className="text-[#00BFFF] text-sm mt-4 inline-block hover:underline">Back to webhooks</Link>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-[1200px] mx-auto space-y-8"
    >
      {/* Back */}
      <Link to="/webhooks" className="inline-flex items-center gap-2 text-sm font-mono text-white/50 hover:text-[#00BFFF] transition-colors duration-150">
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to webhooks
      </Link>

      {/* ===== HEADER ===== */}
      <div className="glass-static" style={{ padding: 40 }}>
        {/* Row 1: Name + status + actions */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00BFFF]/10 border border-[#00BFFF]/20 flex items-center justify-center">
              <Radio size={24} className="text-[#00BFFF]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-white leading-tight">{webhook.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase">{webhook.service}</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono tracking-wider uppercase border ${
                  webhook.status === 'active' ? 'text-[#00E676] bg-[#00E676]/10 border-[#00E676]/20' :
                  webhook.status === 'paused' ? 'text-[#FF6B35] bg-[#FF6B35]/10 border-[#FF6B35]/20' :
                  'text-[#FF3D00] bg-[#FF3D00]/10 border-[#FF3D00]/20'
                }`}>
                  {webhook.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleStatus}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono font-medium border transition-all duration-150 ${
                webhook.status === 'active'
                  ? 'text-[#FF6B35] bg-[#FF6B35]/10 border-[#FF6B35]/20 hover:bg-[#FF6B35]/20'
                  : 'text-[#00E676] bg-[#00E676]/10 border-[#00E676]/20 hover:bg-[#00E676]/20'
              }`}
            >
              {webhook.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
              {webhook.status === 'active' ? 'Pause' : 'Activate'}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono font-medium text-[#FF3D00] bg-[#FF3D00]/10 border border-[#FF3D00]/20 hover:bg-[#FF3D00]/20 transition-all duration-150"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>

        {/* Endpoint URL */}
        <div className="mb-4">
          <label className="block text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase mb-2">Endpoint URL</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm font-mono text-[#00BFFF]/70 truncate">
              {webhook.endpoint_url}
            </div>
            <button onClick={() => copyToClipboard(webhook.endpoint_url, setCopiedUrl)} className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-[#00BFFF] transition-colors">
              {copiedUrl ? <Check size={16} className="text-[#00E676]" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* Secret */}
        <div className="mb-6">
          <label className="block text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase mb-2">Webhook Secret</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm font-mono text-white/40 truncate">
              {showSecret ? webhook.webhook_secret : '\u2022'.repeat(32)}
            </div>
            <button onClick={() => setShowSecret(!showSecret)} className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white transition-colors">
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={() => copyToClipboard(webhook.webhook_secret || '', setCopiedSecret)} className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-[#00BFFF] transition-colors">
              {copiedSecret ? <Check size={16} className="text-[#00E676]" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 pt-6 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-sm font-mono text-white/50">
            <Zap size={16} className="text-[#00BFFF]/50" />
            {webhook.event_count || 0} events received
          </div>
          <div className="flex items-center gap-2 text-sm font-mono text-white/50">
            <Clock size={16} className="text-[#00BFFF]/50" />
            {webhook.last_received_at ? `Last: ${new Date(webhook.last_received_at).toLocaleString()}` : 'No events yet'}
          </div>
          <div className="flex items-center gap-2 text-sm font-mono text-white/50">
            <Code2 size={16} className="text-[#A855F7]/50" />
            {functions.length} functions configured
          </div>
        </div>
      </div>

      {/* ===== FUNCTIONS SECTION ===== */}
      <div className="glass-static" style={{ padding: 32 }}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
              <Code2 size={16} className="text-[#A855F7]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-[22px] font-heading font-bold text-white leading-tight">Functions</h2>
              <p className="text-[13px] font-mono text-white/40 mt-0.5">Processing instructions for incoming data</p>
            </div>
          </div>
          <button
            onClick={() => { setEditingFunction(null); setShowFunctionEditor(true) }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20 text-sm font-mono font-semibold hover:bg-[#A855F7]/20 transition-all duration-150"
          >
            <Plus size={16} strokeWidth={2} />
            Add Function
          </button>
        </div>

        {functions.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-white/[0.01] border border-white/[0.04]">
            <Code2 size={32} className="text-white/15 mx-auto mb-3" strokeWidth={1} />
            <p className="font-mono text-sm text-white/40 mb-1">No functions yet</p>
            <p className="font-body text-sm text-white/25">Add a function to define how incoming data gets processed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {functions.map((fn, i) => (
              <motion.div
                key={fn.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.12] transition-all duration-150 group"
              >
                {/* Reorder buttons */}
                <div className="flex flex-col gap-1 flex-shrink-0 pt-1">
                  <button
                    onClick={() => handleMoveFunction(i, -1)}
                    disabled={i === 0}
                    className="text-white/20 hover:text-white/60 disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMoveFunction(i, 1)}
                    disabled={i === functions.length - 1}
                    className="text-white/20 hover:text-white/60 disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Order number */}
                <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-mono font-bold text-[#A855F7]">{i + 1}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-base font-body font-semibold text-white/90">{fn.name}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase ${
                      fn.is_active
                        ? 'text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/20'
                        : 'text-white/30 bg-white/[0.03] border border-white/[0.06]'
                    }`}>
                      {fn.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {fn.description && (
                    <p className="text-sm font-body text-white/50 mb-2">{fn.description}</p>
                  )}
                  <div className="px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] mt-2">
                    <p className="text-sm font-mono text-white/40 leading-relaxed line-clamp-3 whitespace-pre-wrap">{fn.prompt}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] font-mono text-white/25">{fn.execution_count || 0} executions</span>
                    {fn.last_executed_at && (
                      <span className="text-[11px] font-mono text-white/25">Last: {new Date(fn.last_executed_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggleFunction(fn)}
                    className={`p-2 rounded-lg border transition-all ${fn.is_active ? 'text-[#FF6B35] border-[#FF6B35]/20 hover:bg-[#FF6B35]/10' : 'text-[#00E676] border-[#00E676]/20 hover:bg-[#00E676]/10'}`}
                  >
                    <Power size={14} />
                  </button>
                  <button
                    onClick={() => { setEditingFunction(fn); setShowFunctionEditor(true) }}
                    className="p-2 rounded-lg text-white/40 border border-white/[0.08] hover:text-[#00BFFF] hover:border-[#00BFFF]/20 transition-all"
                  >
                    <Code2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteFunction(fn.id)}
                    className="p-2 rounded-lg text-white/30 border border-white/[0.08] hover:text-[#FF3D00] hover:border-[#FF3D00]/20 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ===== RECENT EVENTS ===== */}
      <div className="glass-static" style={{ padding: 32 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center">
            <Zap size={16} className="text-[#FF6B35]" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-[22px] font-heading font-bold text-white leading-tight">Recent Events</h2>
            <p className="text-[13px] font-mono text-white/40 mt-0.5">Incoming webhook activity log</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-white/[0.01] border border-white/[0.04]">
            <Zap size={32} className="text-white/15 mx-auto mb-3" strokeWidth={1} />
            <p className="font-mono text-sm text-white/40 mb-1">No events received yet</p>
            <p className="font-body text-sm text-white/25">Events will appear here when Fathom sends data to your webhook</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div key={ev.id}>
                <button
                  onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-transparent hover:border-white/[0.08] transition-all duration-150 cursor-pointer text-left"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    ev.status === 'completed' ? 'bg-[#00E676]' :
                    ev.status === 'failed' ? 'bg-[#FF3D00]' :
                    ev.status === 'processing' ? 'bg-[#FF6B35]' :
                    'bg-white/30'
                  }`} />
                  <span className="text-sm font-mono text-white/50">{ev.event_type || 'webhook_event'}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase ${
                    ev.status === 'completed' ? 'text-[#00E676] bg-[#00E676]/10' :
                    ev.status === 'failed' ? 'text-[#FF3D00] bg-[#FF3D00]/10' :
                    'text-white/40 bg-white/[0.03]'
                  }`}>
                    {ev.status}
                  </span>
                  <span className="flex-1" />
                  <span className="text-[13px] font-mono text-white/30">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </button>
                {expandedEvent === ev.id && ev.payload && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mx-4 mb-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-auto max-h-[400px]"
                  >
                    <pre className="text-xs font-mono text-white/50 whitespace-pre-wrap">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Function Editor Modal */}
      {showFunctionEditor && (
        <FunctionEditor
          func={editingFunction}
          webhookId={id}
          onSave={handleSaveFunction}
          onClose={() => { setShowFunctionEditor(false); setEditingFunction(null) }}
        />
      )}
    </motion.div>
  )
}
