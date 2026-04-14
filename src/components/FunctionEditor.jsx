import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Save, Loader2, Code2 } from 'lucide-react'

export default function FunctionEditor({ func, webhookId, onSave, onClose }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (func) {
      setName(func.name || '')
      setDescription(func.description || '')
      setPrompt(func.prompt || '')
      setIsActive(func.is_active ?? true)
    }
  }, [func])

  async function handleSave() {
    if (!name.trim() || !prompt.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      prompt: prompt.trim(),
      is_active: isActive,
    })
    setSaving(false)
  }

  const isEdit = !!func?.id
  const wordCount = prompt.trim() ? prompt.trim().split(/\s+/).length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative glass-static w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        style={{ padding: 32 }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
            <Code2 size={20} className="text-[#A855F7]" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-white">{isEdit ? 'Edit Function' : 'New Function'}</h2>
            <p className="text-[13px] font-mono text-white/40">Define what happens when this webhook fires</p>
          </div>
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Function Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]/30 transition-all duration-150"
            placeholder="e.g., Extract Deal Intelligence"
          />
        </div>

        {/* Description */}
        <div className="mb-5">
          <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Description (optional)</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]/30 transition-all duration-150"
            placeholder="Short description of what this function does"
          />
        </div>

        {/* Prompt — the main event */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase">Prompt / Instructions</label>
            <span className="text-[11px] font-mono text-white/30">{wordCount} words</span>
          </div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="w-full p-5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-mono text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]/30 focus:ring-1 focus:ring-[#A855F7]/15 resize-y transition-all duration-150 leading-relaxed"
            style={{ minHeight: 300 }}
            placeholder={`Describe in natural language what should happen with the incoming webhook data.\n\nExample:\n"When a new meeting comes in from Fathom, extract any pricing discussions, identify the decision makers, and create a follow-up action item if the meeting was a discovery call with an external company.\n\nIf deal value is mentioned, flag this meeting as a hot lead and calculate the estimated annual contract value based on the pricing discussed."`}
          />
        </div>

        {/* Active toggle */}
        <div className="mb-8">
          <button
            onClick={() => setIsActive(!isActive)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 ${
              isActive
                ? 'bg-[#00E676]/5 border-[#00E676]/20 text-white/80'
                : 'bg-white/[0.01] border-white/[0.06] text-white/40'
            }`}
          >
            <div className={`w-8 h-4 rounded-full relative transition-all ${isActive ? 'bg-[#00E676]/30' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${isActive ? 'left-4 bg-[#00E676]' : 'left-0.5 bg-white/40'}`} />
            </div>
            <span className="text-sm font-body font-medium">{isActive ? 'Active — will execute on webhook events' : 'Inactive — will not execute'}</span>
          </button>
        </div>

        {/* Save / Cancel */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !prompt.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20 text-base font-mono font-semibold hover:bg-[#A855F7]/20 transition-all duration-150 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : isEdit ? 'Update Function' : 'Create Function'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-4 rounded-xl bg-white/[0.03] text-white/50 border border-white/[0.08] text-base font-mono font-medium hover:bg-white/[0.06] transition-all duration-150"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  )
}
