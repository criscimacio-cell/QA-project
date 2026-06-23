import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles, FileText, CheckCircle, Clock, Eye, Upload, Globe } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

const FLOAT_CHIPS = [
  { file: 'Q4_Finance_Report.pdf',    status: 'Approved',        icon: CheckCircle, color: '#10b981', x: -38, y: -8,  depth: 1.5, rot: -4, delay: 0    },
  { file: 'Legal_NDA_v3.pdf',         status: 'In Review',       icon: Eye,         color: '#f59e0b', x: 36,  y: -16, depth: 1.1, rot:  4, delay: 0.05 },
  { file: 'Employee_Handbook.docx',   status: 'Pending',         icon: Clock,       color: '#94a3b8', x: -40, y: 24,  depth: 0.7, rot:  3, delay: 0.1  },
  { file: 'Brand_Guidelines.pdf',     status: 'Published',       icon: Globe,       color: '#10b981', x: 40,  y: 22,  depth: 1.3, rot: -3, delay: 0.08 },
  { file: 'Sales_Contract.docx',      status: 'Uploaded',        icon: Upload,      color: '#f59e0b', x: -14, y: -26, depth: 0.5, rot:  2, delay: 0.12 },
  { file: 'Compliance_Policy.pdf',    status: 'Approved',        icon: CheckCircle, color: '#10b981', x: 20,  y: 36,  depth: 0.9, rot: -2, delay: 0.06 },
  { file: 'Budget_Forecast_Q1.xlsx',  status: 'Awaiting review', icon: Clock,       color: '#f59e0b', x: -26, y: 38,  depth: 1.6, rot:  5, delay: 0.14 },
  { file: 'Product_Roadmap.pptx',     status: 'In Review',       icon: Eye,         color: '#f59e0b', x: 44,  y: 4,   depth: 0.6, rot: -4, delay: 0.09 },
];

const FLOAT_VARIANTS = [
  { y: [0, -8, 0], dur: 4.2 },
  { y: [0,  7, 0], dur: 3.8 },
  { y: [0, -6, 0], dur: 5.0 },
  { y: [0,  9, 0], dur: 4.5 },
  { y: [0, -8, 0], dur: 3.6 },
  { y: [0,  5, 0], dur: 4.8 },
  { y: [0,-10, 0], dur: 4.0 },
  { y: [0,  8, 0], dur: 3.9 },
];

export default function Hero() {
  const heroRef   = useRef<HTMLElement>(null);
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      rawMouseX.set(((e.clientX - rect.left) / rect.width  - 0.5) * 2);
      rawMouseY.set(((e.clientY - rect.top)  / rect.height - 0.5) * 2);
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, [rawMouseX, rawMouseY]);

  return (
    <section ref={heroRef} className="relative overflow-hidden min-h-screen flex items-center bg-[#FAFAFA]">
      <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 48%, rgba(245,158,11,0.06) 0%, transparent 70%)' }} />

      {/* Floating chip field */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ opacity: 0.9 }}>
        {FLOAT_CHIPS.map((chip, i) => (
          <FloatingChip
            key={chip.file}
            chip={chip}
            rawX={rawMouseX}
            rawY={rawMouseY}
            floatV={FLOAT_VARIANTS[i % FLOAT_VARIANTS.length]}
          />
        ))}
      </div>

      {/* Vignette */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 35%, rgba(250,250,250,0.88) 78%, rgba(250,250,250,1) 100%)' }} />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-40 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(250,250,250,1) 0%, rgba(250,250,250,0.85) 60%, transparent 100%)' }} />

      {/* Hero copy */}
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

function FloatingChip({ chip, rawX, rawY, floatV }: {
  chip: typeof FLOAT_CHIPS[number];
  rawX: ReturnType<typeof useMotionValue<number>>;
  rawY: ReturnType<typeof useMotionValue<number>>;
  floatV: typeof FLOAT_VARIANTS[number];
}) {
  const Icon = chip.icon;
  const springCfg = { stiffness: 35 + chip.depth * 14, damping: 22, mass: 1.1 };
  const mx = useSpring(rawX, springCfg);
  const my = useSpring(rawY, springCfg);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.6 + chip.delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="absolute"
      style={{
        left: `calc(50% + ${chip.x}%)`,
        top:  `calc(50% + ${chip.y}%)`,
        transform: 'translate(-50%, -50%)',
        zIndex: Math.round(chip.depth * 3),
      }}
    >
      <motion.div style={{ x: mx, y: my, rotateZ: chip.rot }}>
        <motion.div
          animate={{ y: floatV.y }}
          transition={{ duration: floatV.dur, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }}
          style={{ scale: 0.85 + chip.depth * 0.09 }}
        >
          {/* Minimal pill chip */}
          <div
            className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full pl-2 pr-3.5 py-1.5 select-none"
            style={{
              border: '1px solid rgba(0,0,0,0.07)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${chip.color}18` }}>
              <FileText size={10} style={{ color: chip.color }} />
            </div>
            <span className="text-[10px] font-medium text-slate-600 max-w-[110px] truncate leading-none">
              {chip.file}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: chip.color }} />
              <Icon size={9} style={{ color: chip.color }} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
