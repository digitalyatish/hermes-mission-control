import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

function AnimatedNumber({ value, duration = 1.5 }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const animate = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value, duration])

  return display
}

export default function MetricCard({ icon: Icon, label, value, subtitle, color = '#00BFFF', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="glass group cursor-default"
      style={{ padding: 36 }}
    >
      <div className="flex items-start justify-between mb-6">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, boxShadow: `0 0 30px -5px ${color}30` }}
        >
          <Icon size={20} style={{ color }} strokeWidth={1.5} />
        </div>
        <motion.div
          className="w-2 h-2 rounded-full mt-1"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          animate={{ scale: [1, 1.15, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>
      <p className="text-[11px] font-mono tracking-[0.2em] text-white/60 uppercase mb-3">{label}</p>
      <p
        className="font-heading font-bold text-white leading-none"
        style={{
          fontSize: 64,
          letterSpacing: '-0.02em',
          textShadow: `0 0 40px ${color}40, 0 0 80px ${color}15`,
          marginBottom: 8,
        }}
      >
        <AnimatedNumber value={value} />
      </p>
      {subtitle && <p className="text-[13px] font-body text-white/50">{subtitle}</p>}
    </motion.div>
  )
}
