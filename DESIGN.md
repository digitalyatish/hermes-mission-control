# Design System — Mission Control

## Theme
- Background: #0A0A0F (near black void)
- Cards: glassmorphic — bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]
- Primary: #00E5FF (teal neon)
- Accent: #FF6B35 (orange neon)
- Success: #00E676 (green)
- Danger: #FF3D00 (red)
- Glow on hover: shadow-[0_0_30px_rgba(0,229,255,0.1)]
- Rounded-xl corners on everything

## Typography
- Headings: Orbitron (geometric, techy, futuristic)
- Body: Rajdhani (clean futuristic sans-serif)
- Data/numbers/mono: JetBrains Mono
- Import via Google Fonts

## Card Style
- Glass effect: bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]
- Inner glow: shadow-inner with rgba(0,229,255,0.02)
- Glow on hover: shadow-[0_0_30px_rgba(0,229,255,0.1)]
- Rounded-xl (16px) corners
- Subtle gradient borders on featured cards
- No solid backgrounds — everything is translucent

## Charts & Data Visualization
- Use Recharts
- Neon teal (#00E5FF) for primary data lines
- Orange (#FF6B35) for secondary/comparison
- Glow effect on data points (filter: drop-shadow)
- Dark grid lines: rgba(255,255,255,0.05)
- Animated number counters on load (count up from 0)
- Sparkline mini-charts in metric cards

## Animations
- Framer Motion for all entrances (fade up + scale in, 300ms)
- Smooth hover transitions (200ms ease)
- Number counters animate on mount
- Skeleton loading states with pulse animation
- Subtle parallax on scroll

## Layout
- Full dark background, no white anywhere
- Sidebar navigation with glass effect
- Main content area with responsive grid
- Metric cards at top (deal pipeline)
- Data tables with alternating subtle row highlights
- No harsh borders — use glass effect separation

## Status Indicators
- Active/online: teal dot with pulse animation
- Warning: orange dot
- Error: red dot
- Neutral: dim white dot

## Iconography
- Lucide React icons
- Thin stroke weight (1.5px)
- Teal color for navigation icons
- Orange for action/CTA icons

## Vibe
- Vercel's dashboard meets a sci-fi command center
- Every pixel should feel like it belongs in a movie
- This is NOT a CRUD app. This is Mission Control.
- Dark, sleek, futuristic — like controlling a fleet of AI agents from a space station
- Minimal text, maximum data density
- Let the numbers and charts tell the story
