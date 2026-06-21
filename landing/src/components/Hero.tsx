import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles, FileText, CheckCircle, Clock, Eye, Upload, Globe } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

// Each floating card: position (% from center), depth layer, content
// Palette: amber (brand) · emerald (approved/published) · slate (neutral)
const FLOAT_CARDS = [
  {
    file: 'Q4_Finance_Report_v2.pdf',
    status: 'Approved',
    icon: CheckCircle,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.22)',
    avatar: 'SK',
    x: -38, y: -22,
    depth: 1.6,
    rot: -6,
    delay: 0,
  },
  {
    file: 'Legal_NDA_Template_v3.pdf',
    status: 'In Review',
    icon: Eye,
    color: '#d97706',
    bg: 'rgba(245,158,11,0.09)',
    border: 'rgba(245,158,11,0.28)',
    avatar: 'PM',
    x: 36, y: -28,
    depth: 1.2,
    rot: 5,
    delay: 0.05,
  },
  {
    file: 'Employee_Handbook_2025.docx',
    status: 'Pending',
    icon: Clock,
    color: '#b45309',
    bg: 'rgba(180,83,9,0.07)',
    border: 'rgba(180,83,9,0.20)',
    avatar: 'MT',
    x: -44, y: 24,
    depth: 0.8,
    rot: 4,
    delay: 0.1,
  },
  {
    file: 'Brand_Guidelines_v2.pdf',
    status: 'Published',
    icon: Globe,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.22)',
    avatar: 'AL',
    x: 40, y: 22,
    depth: 1.4,
    rot: -4,
    delay: 0.08,
  },
  {
    file: 'Sales_Contract_Acme.docx',
    status: 'Uploaded',
    icon: Upload,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.09)',
    border: 'rgba(245,158,11,0.25)',
    avatar: 'JR',
    x: -14, y: -44,
    depth: 0.6,
    rot: 2,
    delay: 0.12,
  },
  {
    file: 'Compliance_Policy_2025.pdf',
    status: 'Approved',
    icon: CheckCircle,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    avatar: 'TB',
    x: 18, y: 44,
    depth: 1.0,
    rot: -3,
    delay: 0.06,
  },
  {
    file: 'Budget_Forecast_Q1.xlsx',
    status: 'Awaiting review',
    icon: Clock,
    color: '#d97706',
    bg: 'rgba(245,158,11,0.09)',
    border: 'rgba(245,158,11,0.28)',
    avatar: 'PM',
    x: -26, y: 46,
    depth: 1.8,
    rot: 7,
    delay: 0.14,
  },
  {
    file: 'Product_Roadmap_Draft.pptx',
    status: 'In Review',
    icon: Eye,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.09)',
    border: 'rgba(245,158,11,0.25)',
    avatar: 'SK',
    x: 46, y: -6,
    depth: 0.7,
    rot: -5,
    delay: 0.09,
  },
];

// Gentle float animation — each card bobs independently
const FLOAT_VARIANTS = [
  { y: [0, -10, 0], duration: 4.2 },
  { y: [0, 8,  0], duration: 3.8 },
  { y: [0, -7, 0], duration: 5.0 },
  { y: [0, 10, 0], duration: 4.5 },
  { y: [0, -9, 0], duration: 3.6 },
  { y: [0, 6,  0], duration: 4.8 },
  { y: [0, -11,0], duration: 4.0 },
  { y: [0, 9,  0], duration: 3.9 },
];


export default function Hero() {
  const heroRef    = useRef<HTMLElement>(null);
  const rawMouseX  = useMotionValue(0);
  const rawMouseY  = useMotionValue(0);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      // Normalize to -1 … 1 from center
      rawMouseX.set(((e.clientX - rect.left) / rect.width  - 0.5) * 2);
      rawMouseY.set(((e.clientY - rect.top)  / rect.height - 0.5) * 2);
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, [rawMouseX, rawMouseY]);

  return (
    <section ref={heroRef} className="relative overflow-hidden min-h-screen flex items-center bg-[#FAFAFA]">
      <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />

      {/* Radial ambient */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 48%, rgba(245,158,11,0.06) 0%, transparent 70%)' }} />

      {/* ── Floating card field ─────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {FLOAT_CARDS.map((card, i) => {
          // Scale parallax offset by depth — deeper = more pixels
          return (
            <FloatingCardScaled
              key={card.file}
              card={card}
              rawX={rawMouseX}
              rawY={rawMouseY}
              floatV={FLOAT_VARIANTS[i % FLOAT_VARIANTS.length]}
            />
          );
        })}
      </div>

      {/* Vignette edges so cards fade near boundary */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 40%, rgba(250,250,250,0.85) 80%, rgba(250,250,250,1) 100%)' }} />

      {/* ── Hero text ──────────────────────────────────────────── */}
      <div className="relative w-full max-w-4xl mx-auto px-6 py-32 pt-36 flex flex-col items-center gap-7 text-center z-10">
        <motion.div variants={stagger(0.09)} initial="hidden" animate="show"
          className="flex flex-col items-center gap-6 w-full">

          <motion.div variants={blurUp} className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700 shadow-sm">
              <Sparkles size={11} /> Now in early access
            </span>
            {BADGES.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-500 shadow-sm">
                <CheckCircle2 size={11} className="text-amber-500" /> {b}
              </span>
            ))}
          </motion.div>

          <motion.h1 variants={blurUp}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.12]">
            <span className="text-slate-900">One place for all</span>
            <br />
            <span className="text-gradient">your documents.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="max-w-xl text-lg sm:text-xl text-slate-500 leading-relaxed">
            Qlarity keeps every file, approval, and version in one place — so nothing gets lost in email threads, chat messages, or shared drives.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3 justify-center">
            <MagneticButton href="/register"
              className="shimmer-btn inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-amber-200/60 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              Start for Free <ArrowRight size={16} />
            </MagneticButton>
            <MagneticButton href="#how-it-works" strength={0.22}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium px-8 py-3.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              <Play size={14} className="fill-current text-amber-500" /> See How It Works
            </MagneticButton>
          </motion.div>

          <motion.p variants={fadeUp} className="text-xs text-slate-400">
            No credit card required · Free to get started
          </motion.p>

          {/* Live indicator */}
          <motion.div variants={fadeUp}
            className="flex items-center gap-2 bg-white/80 backdrop-blur border border-slate-200 rounded-full px-4 py-2 shadow-sm text-xs text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Move your cursor — your documents follow
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div aria-hidden="true"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
        <span className="text-xs text-slate-400">Scroll to explore</span>
        <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 rounded-full border border-slate-300 flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 bg-amber-500/60 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// Separate component so each card can call useSpring/useTransform at top level
function FloatingCardScaled({ card, rawX, rawY, floatV }: {
  card: typeof FLOAT_CARDS[number];
  rawX: ReturnType<typeof useMotionValue<number>>;
  rawY: ReturnType<typeof useMotionValue<number>>;
  floatV: typeof FLOAT_VARIANTS[number];
}) {
  const Icon = card.icon;

  const springCfg = { stiffness: 35 + card.depth * 15, damping: 22, mass: 1.1 };
  const mx = useSpring(rawX, springCfg);
  const my = useSpring(rawY, springCfg);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.75, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.5 + card.delay, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="absolute"
      style={{
        left: `calc(50% + ${card.x}%)`,
        top:  `calc(50% + ${card.y}%)`,
        transform: 'translate(-50%, -50%)',
        zIndex: Math.round(card.depth * 3),
      }}
    >
      <motion.div
        style={{ x: mx, y: my, rotateZ: card.rot }}
        // Override y with float bob (additive via separate animate)
      >
        <motion.div
          animate={{ y: floatV.y }}
          transition={{ duration: floatV.duration, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }}
          // scale per depth so close cards feel bigger
          style={{ scale: 0.82 + card.depth * 0.11 }}
        >
          <div
            className="bg-white/90 backdrop-blur-sm rounded-xl px-3.5 py-3 shadow-lg select-none"
            style={{
              border: `1.5px solid ${card.border}`,
              minWidth: 190,
              maxWidth: 225,
              boxShadow: `0 ${Math.round(card.depth * 6)}px ${Math.round(card.depth * 24)}px rgba(0,0,0,${0.05 + card.depth * 0.04}), 0 0 0 1px ${card.border}`,
            }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: card.bg }}>
                <FileText size={13} style={{ color: card.color }} />
              </div>
              <span className="text-[10px] font-semibold text-slate-700 truncate leading-tight">{card.file}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon size={10} style={{ color: card.color }} />
                <span className="text-[10px] font-medium" style={{ color: card.color }}>{card.status}</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <span className="text-[7px] font-bold text-white">{card.avatar}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
