import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Radio, Check, Copy, Loader2, Phone, Mail, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SERVICES = [
  { key: 'fathom', label: 'Fathom', icon: Phone, color: '#00BFFF', description: 'Meeting recordings & transcripts' },
  { key: 'resend', label: 'Resend', icon: Mail, color: '#00E676', description: 'Email delivery events' },
  { key: 'custom', label: 'Custom', icon: Globe, color: '#A855F7', description: 'Any external service' },
]

export default function AddWebhookModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [service, setService] = useState('fathom')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [includeTranscript, setIncludeTranscript] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeActionItems, setIncludeActionItems] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  async function handleRegister() {
    if (!name.trim()) return
    setRegistering(true)
    setError(null)

    try {
      if (service === 'fathom') {
        // Use the server-side Edge Function to register with Fathom API
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-fathom-webhook`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              config: {
                triggered_for: ['my_recordings'],
                include_transcript: includeTranscript,
                include_summary: includeSummary,
                include_action_items: includeActionItems,
              },
            }),
          }
        )

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || data.details || 'Registration failed')

        setResult({
          webhook: data.webhook,
          endpointUrl: data.endpoint_url,
          secret: data.secret,
        })
      } else {
        // Generic webhook: create locally with user-provided secret (or none)
        const webhookId = crypto.randomUUID()
        const endpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fathom-webhook?id=${webhookId}`

        const { data, error: dbError } = await supabase
          .from('webhooks')
          .insert({
            id: webhookId,
            name: name.trim(),
            service,
            endpoint_url: endpointUrl,
            webhook_secret: webhookSecret.trim() || null,
            config: { service },
            status: 'active',
          })
          .select()
          .single()

        if (dbError) throw dbError

        setResult({
          webhook: data,
          endpointUrl,
          secret: webhookSecret.trim() || null,
        })
      }
    } catch (err) {
      setError(err.message || 'Failed to register webhook')
    } finally {
      setRegistering(false)
    }
  }

  function copyToClipboard(text, setter) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const selectedService = SERVICES.find(s => s.key === service)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative glass-static w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        style={{ padding: 32 }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors">
          <X size={20} />
        </button>

        {!result ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#00BFFF]/10 border border-[#00BFFF]/20 flex items-center justify-center">
                <Radio size={20} className="text-[#00BFFF]" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-white">Register Webhook</h2>
                <p className="text-[13px] font-mono text-white/40">Connect an external service</p>
              </div>
            </div>

            {/* Service selector */}
            <div className="mb-6">
              <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-3">Service</label>
              <div className="grid grid-cols-3 gap-2">
                {SERVICES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setService(s.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150 ${
                      service === s.key
                        ? `bg-[${s.color}]/10 border-[${s.color}]/20 text-white`
                        : 'bg-white/[0.01] border-white/[0.06] text-white/40 hover:text-white/60 hover:border-white/10'
                    }`}
                    style={service === s.key ? { background: `${s.color}10`, borderColor: `${s.color}33` } : {}}
                  >
                    <s.icon size={20} style={service === s.key ? { color: s.color } : {}} strokeWidth={1.5} />
                    <span className="text-sm font-mono font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[12px] font-body text-white/30 mt-2">{selectedService?.description}</p>
            </div>

            {/* Name */}
            <div className="mb-6">
              <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Webhook Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#00BFFF]/30 transition-all duration-150"
                placeholder={service === 'fathom' ? 'Fathom New Meeting' : service === 'resend' ? 'Resend Email Events' : 'My Webhook'}
              />
            </div>

            {/* Webhook Secret — only for non-Fathom (Fathom generates its own) */}
            {service !== 'fathom' && (
              <div className="mb-6">
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">
                  Webhook Secret <span className="text-white/25">(optional)</span>
                </label>
                <input
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-mono text-white/60 placeholder:text-white/25 focus:outline-none focus:border-[#00BFFF]/30 transition-all duration-150"
                  placeholder="Leave empty if not needed"
                />
                <p className="text-[11px] font-body text-white/25 mt-1.5">Used for HMAC signature verification. Only add if the service provides one.</p>
              </div>
            )}

            {/* Fathom-specific config */}
            {service === 'fathom' && (
              <div className="mb-6">
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-3">Include in Payload</label>
                <div className="space-y-2">
                  {[
                    { label: 'Transcript', value: includeTranscript, set: setIncludeTranscript },
                    { label: 'Summary', value: includeSummary, set: setIncludeSummary },
                    { label: 'Action Items', value: includeActionItems, set: setIncludeActionItems },
                  ].map(t => (
                    <button
                      key={t.label}
                      onClick={() => t.set(!t.value)}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all duration-150 ${
                        t.value
                          ? 'bg-[#00BFFF]/5 border-[#00BFFF]/20 text-white/80'
                          : 'bg-white/[0.01] border-white/[0.06] text-white/40'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        t.value ? 'bg-[#00BFFF]/20 border-[#00BFFF]/40' : 'border-white/20'
                      }`}>
                        {t.value && <Check size={12} className="text-[#00BFFF]" strokeWidth={2.5} />}
                      </div>
                      <span className="text-sm font-body font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-[#FF3D00]/10 border border-[#FF3D00]/20 text-sm font-mono text-[#FF3D00]">
                {error}
              </div>
            )}

            {/* Register button */}
            <button
              onClick={handleRegister}
              disabled={registering || !name.trim()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-mono font-semibold transition-all duration-150 disabled:opacity-50 border"
              style={{
                background: `${selectedService?.color}15`,
                color: selectedService?.color,
                borderColor: `${selectedService?.color}33`,
              }}
            >
              {registering ? <Loader2 size={18} className="animate-spin" /> : <Radio size={18} />}
              {registering ? 'Registering...' : 'Register Webhook'}
            </button>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-[#00E676]" strokeWidth={2} />
              </div>
              <h2 className="text-xl font-heading font-bold text-white">Webhook Registered</h2>
              <p className="text-[13px] font-mono text-white/40 mt-1">
                {service === 'fathom' ? 'Fathom has been configured to send events to this endpoint' : 'Add this URL to your service\'s webhook settings'}
              </p>
            </div>

            {/* Endpoint URL */}
            <div className="mb-4">
              <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Endpoint URL</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-mono text-[#00BFFF]/80 truncate">
                  {result.endpointUrl}
                </div>
                <button
                  onClick={() => copyToClipboard(result.endpointUrl, setCopiedUrl)}
                  className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/50 hover:text-[#00BFFF] transition-colors"
                >
                  {copiedUrl ? <Check size={16} className="text-[#00E676]" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* Secret — only show if there is one */}
            {result.secret && (
              <div className="mb-8">
                <label className="block text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase mb-2">Webhook Secret</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-sm font-mono text-white/40 truncate">
                    {result.secret}
                  </div>
                  <button
                    onClick={() => copyToClipboard(result.secret, setCopiedSecret)}
                    className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/50 hover:text-[#00BFFF] transition-colors"
                  >
                    {copiedSecret ? <Check size={16} className="text-[#00E676]" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={onCreated}
              className="w-full py-4 rounded-xl bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-base font-mono font-semibold hover:bg-[#00BFFF]/20 transition-all duration-150"
            >
              Done
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
