import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Target, MapPin, Search, Loader2, Check, Zap, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

const VERTICALS = [
  'Accounting', 'Dental', 'Law Firm', 'Real Estate', 'Insurance', 'IT Consulting',
  'Medical Clinic', 'Chiropractic', 'Financial Advisory', 'Marketing Agency',
  'Construction', 'Restaurant', 'Auto Repair', 'Plumbing', 'HVAC',
  'Veterinary', 'Optometry', 'Physical Therapy', 'Architecture', 'Other',
]

const LOCATIONS = {
  'Canada': ['Vancouver BC', 'Toronto ON', 'Calgary AB', 'Edmonton AB', 'Ottawa ON', 'Montreal QC', 'Winnipeg MB', 'Halifax NS', 'Victoria BC', 'Saskatoon SK'],
  'United States': ['New York NY', 'Los Angeles CA', 'Chicago IL', 'Houston TX', 'Phoenix AZ', 'Seattle WA', 'Denver CO', 'Austin TX', 'Portland OR', 'San Diego CA', 'Miami FL', 'Atlanta GA', 'Dallas TX', 'Boston MA', 'San Francisco CA'],
}

const STEPS = ['ICP', 'Location', 'Scrape', 'Results']

export default function ICPCampaignWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(0)

  // Step 1: ICP
  const [vertical, setVertical] = useState('')
  const [customVertical, setCustomVertical] = useState('')
  const [icpName, setIcpName] = useState('')

  // Step 2: Location
  const [country, setCountry] = useState('Canada')
  const [city, setCity] = useState('')

  // Step 3: Scrape
  const [maxResults, setMaxResults] = useState(20)
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState(null)
  const [scrapeError, setScrapeError] = useState(null)

  // Step 4: Results
  const [createCampaign, setCreateCampaign] = useState(true)
  const [campaignName, setCampaignName] = useState('')

  const actualVertical = vertical === 'Other' ? customVertical : vertical
  const searchQuery = `${actualVertical.toLowerCase()} in ${city}`

  async function runScrape() {
    setScraping(true)
    setScrapeError(null)

    try {
      // First create ICP
      const { data: icp } = await supabase.from('icps').insert({
        name: icpName || `${actualVertical} — ${city}`,
        industry_verticals: [actualVertical.toLowerCase()],
        geographies: [city],
        is_active: true,
      }).select('id').single()

      // Run the scraper via API
      const API_KEY = localStorage.getItem('hermes_api_key') || import.meta.env.VITE_HERMES_API_KEY
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hermes-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
          action: 'scrapers.run',
          params: {
            scraper_type: 'google_maps',
            query: searchQuery,
            icp_id: icp?.id,
            max_results: maxResults,
            auto_create_campaign: createCampaign,
            campaign_name: campaignName || `${actualVertical} — ${city} Outreach`,
          },
        }),
      })

      const result = await resp.json()
      if (!result.ok) throw new Error(result.error || 'Scraper failed')
      setScrapeResult(result.data)
    } catch (err) {
      setScrapeError(err.message)
    } finally {
      setScraping(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative glass-static w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto"
        style={{ padding: 32 }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"><X size={20} /></button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold ${
                i === step ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30' :
                i < step ? 'bg-[#00E676]/20 text-[#00E676]' : 'bg-white/[0.04] text-white/30'
              }`}>{i < step ? <Check size={12} /> : i + 1}</div>
              <span className={`text-[12px] font-mono ${i === step ? 'text-white/70' : 'text-white/30'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Step 1: ICP / Vertical */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center">
                <Target size={20} className="text-[#00E676]" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-white">Choose Your Vertical</h2>
                <p className="text-[13px] font-mono text-white/40">What type of business are you targeting?</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {VERTICALS.map(v => (
                <button key={v} onClick={() => setVertical(v)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all text-sm font-body ${
                    vertical === v ? 'bg-[#00E676]/10 border-[#00E676]/20 text-white' : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:border-white/10'
                  }`}>
                  {v}
                </button>
              ))}
            </div>

            {vertical === 'Other' && (
              <input value={customVertical} onChange={e => setCustomVertical(e.target.value)}
                placeholder="Enter your vertical (e.g., Pet Grooming)"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#00E676]/30" />
            )}

            <div>
              <label className="block text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase mb-2">ICP Name (optional)</label>
              <input value={icpName} onChange={e => setIcpName(e.target.value)}
                placeholder={actualVertical ? `${actualVertical} ICP` : 'Auto-generated'}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/25 focus:outline-none" />
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#00BFFF]/10 border border-[#00BFFF]/20 flex items-center justify-center">
                <MapPin size={20} className="text-[#00BFFF]" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-white">Select Location</h2>
                <p className="text-[13px] font-mono text-white/40">Where should we look for {actualVertical.toLowerCase()}?</p>
              </div>
            </div>

            {/* Country */}
            <div className="flex gap-2">
              {Object.keys(LOCATIONS).map(c => (
                <button key={c} onClick={() => { setCountry(c); setCity('') }}
                  className={`flex-1 py-3 rounded-xl border text-sm font-mono text-center transition-all ${
                    country === c ? 'bg-[#00BFFF]/10 border-[#00BFFF]/20 text-[#00BFFF]' : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:border-white/10'
                  }`}>
                  {c === 'Canada' ? '\uD83C\uDDE8\uD83C\uDDE6' : '\uD83C\uDDFA\uD83C\uDDF8'} {c}
                </button>
              ))}
            </div>

            {/* City */}
            <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto">
              {(LOCATIONS[country] || []).map(c => (
                <button key={c} onClick={() => setCity(c)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all text-sm font-body ${
                    city === c ? 'bg-[#00BFFF]/10 border-[#00BFFF]/20 text-white' : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:border-white/10'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Scrape Config + Execute */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center">
                <Search size={20} className="text-[#FF6B35]" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-white">Find Leads</h2>
                <p className="text-[13px] font-mono text-white/40">Scraping Google Maps for businesses</p>
              </div>
            </div>

            {/* Search preview */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[11px] font-mono text-white/40 uppercase mb-1">Search Query</p>
              <p className="text-base font-mono text-[#00BFFF]">"{searchQuery}"</p>
            </div>

            <div>
              <label className="block text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase mb-2">Max Results</label>
              <div className="flex gap-2">
                {[10, 20, 30, 50].map(n => (
                  <button key={n} onClick={() => setMaxResults(n)}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-mono transition-all ${
                      maxResults === n ? 'bg-[#FF6B35]/10 border-[#FF6B35]/20 text-[#FF6B35]' : 'bg-white/[0.02] border-white/[0.06] text-white/50'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-body text-white/25 mt-1">Estimated cost: ~${(maxResults * 0.00004).toFixed(4)}</p>
            </div>

            <div>
              <button onClick={() => setCreateCampaign(!createCampaign)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all ${
                  createCampaign ? 'bg-[#00E676]/5 border-[#00E676]/20 text-white/80' : 'bg-white/[0.01] border-white/[0.06] text-white/40'
                }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${createCampaign ? 'bg-[#00E676]/20 border-[#00E676]/40' : 'border-white/20'}`}>
                  {createCampaign && <Check size={12} className="text-[#00E676]" strokeWidth={2.5} />}
                </div>
                <span className="text-sm font-body">Auto-create campaign (AI will personalize emails)</span>
              </button>
            </div>

            {createCampaign && (
              <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                placeholder={`${actualVertical} — ${city} Outreach`}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-base font-body text-white/80 placeholder:text-white/25 focus:outline-none" />
            )}

            {!scrapeResult && !scraping && (
              <button onClick={runScrape}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-xl bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/20 text-base font-mono font-semibold hover:bg-[#FF6B35]/20 transition-all">
                <Zap size={20} /> Start Scraping
              </button>
            )}

            {scraping && (
              <div className="text-center py-8">
                <Loader2 size={32} className="text-[#FF6B35] animate-spin mx-auto mb-4" />
                <p className="text-base font-body text-white/60">Scraping Google Maps...</p>
                <p className="text-sm font-mono text-white/30 mt-1">This takes 30-60 seconds</p>
              </div>
            )}

            {scrapeError && (
              <div className="p-4 rounded-xl bg-[#FF3D00]/10 border border-[#FF3D00]/20 text-sm font-mono text-[#FF3D00]">
                {scrapeError}
              </div>
            )}

            {scrapeResult && (
              <div className="p-5 rounded-xl bg-[#00E676]/5 border border-[#00E676]/20 space-y-2">
                <div className="flex items-center gap-2 text-[#00E676] mb-2">
                  <Check size={20} />
                  <span className="text-base font-mono font-semibold">Scrape Complete!</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <p className="text-2xl font-heading font-bold text-white">{scrapeResult.leads_created}</p>
                    <p className="text-[11px] font-mono text-white/40">Leads Found</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <p className="text-2xl font-heading font-bold text-white">${(scrapeResult.cost_usd || 0).toFixed(4)}</p>
                    <p className="text-[11px] font-mono text-white/40">Cost</p>
                  </div>
                </div>
                {scrapeResult.campaign_id && (
                  <p className="text-sm font-mono text-[#00BFFF]/60 mt-2">
                    <Zap size={12} className="inline mr-1" /> Campaign created — AI is preparing personalized emails
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono text-white/50 hover:text-white/70">
            <ChevronLeft size={16} /> {step > 0 ? 'Back' : 'Cancel'}
          </button>

          {step < 2 ? (
            <button onClick={() => setStep(step + 1)}
              disabled={(step === 0 && !actualVertical) || (step === 1 && !city)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00BFFF]/10 text-[#00BFFF] border border-[#00BFFF]/20 text-sm font-mono font-semibold hover:bg-[#00BFFF]/20 transition-all disabled:opacity-30">
              Next <ChevronRight size={16} />
            </button>
          ) : scrapeResult ? (
            <button onClick={() => onCreated?.()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-sm font-mono font-semibold hover:bg-[#00E676]/20 transition-all">
              Done <Check size={16} />
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
