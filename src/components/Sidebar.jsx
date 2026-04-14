import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Calendar, Phone, Mail, Radio, Brain, BookOpen, Activity, Plug, Settings, Zap } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/meetings', icon: Phone, label: 'Meetings' },
  { to: '/outreach', icon: Mail, label: 'Outreach' },
  { to: '/webhooks', icon: Radio, label: 'Webhooks' },
  { to: '/skills', icon: Brain, label: 'Skills' },
  { to: '/memory', icon: BookOpen, label: 'Memory' },
  { to: '/ai-log', icon: Activity, label: 'AI Log' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
]

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-[280px] py-6 px-3 bg-[#0C0C12] border-r border-white/[0.06]">
      {/* Logo — centered block with border */}
      <div className="flex flex-col items-center text-center pt-2 pb-10 border-b border-white/[0.06] mb-8 mx-2">
        {/* Pulsing icon */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 20px rgba(0, 191, 255, 0.3)',
              '0 0 40px rgba(0, 191, 255, 0.6)',
              '0 0 20px rgba(0, 191, 255, 0.3)',
            ]
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00BFFF] to-[#0066CC] flex items-center justify-center mb-4"
        >
          <Zap size={28} className="text-[#0A0A0F]" strokeWidth={2.5} />
        </motion.div>

        {/* Wordmark */}
        <h1 className="text-2xl font-heading font-bold tracking-tight text-white">HERMES</h1>

        {/* Subtitle */}
        <p className="mt-1 text-[10px] tracking-[0.3em] text-[#00BFFF]/70 font-medium uppercase font-mono">
          Mission Control
        </p>

        {/* System status pill */}
        <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00E676]/10 border border-[#00E676]/20">
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-[#00E676]"
          />
          <span className="text-[9px] tracking-wider text-[#00E676] font-medium uppercase font-mono">
            System Online
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <div className="px-5 mb-3 text-[10px] tracking-[0.25em] text-white/30 font-medium uppercase font-mono">
          Menu
        </div>
        <div className="space-y-1.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-lg text-base font-body font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#00BFFF]/15 to-[#00BFFF]/0 text-[#67E8F9] border-l-[3px] border-[#00BFFF] shadow-[-1px_0_12px_rgba(0,191,255,0.4)]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04] border-l-[3px] border-transparent'
                }`
              }
              style={{ minHeight: 52, paddingTop: 14, paddingBottom: 14, paddingLeft: 20, paddingRight: 20 }}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* System section */}
      <div className="pb-2">
        <div className="px-5 mb-3 text-[10px] tracking-[0.25em] text-white/30 font-medium uppercase font-mono">
          System
        </div>
        <NavLink
          to="/settings"
          className="flex items-center gap-3.5 rounded-lg text-base font-body font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition-all duration-150 border-l-[3px] border-transparent"
          style={{ minHeight: 52, paddingTop: 14, paddingBottom: 14, paddingLeft: 20, paddingRight: 20 }}
        >
          <Settings size={22} strokeWidth={1.5} />
          <span>Settings</span>
        </NavLink>

        {/* Agent sync status */}
        <div className="mt-4 mx-2 p-4 glass-static rounded-xl">
          <div className="flex items-center gap-2.5 mb-1.5">
            <motion.div
              className="w-2 h-2 rounded-full bg-[#00E676]"
              animate={{ scale: [1, 1.15, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
            />
            <span className="text-[12px] font-mono text-[#00E676] font-semibold">HERMES ONLINE</span>
          </div>
          <p className="text-[11px] text-white/40 font-mono leading-relaxed">Agent active &bull; 111 meetings synced</p>
        </div>
      </div>
    </aside>
  )
}
