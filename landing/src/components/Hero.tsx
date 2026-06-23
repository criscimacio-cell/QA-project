import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';
import {
  ArrowRight, Play, CheckCircle2, Sparkles, FileText,
  CheckCircle, Eye, Upload, Globe, Clock,
} from 'lucide-react';
import { blurUp, fadeUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

// 4 cards — one per stage, stacked in 3D with offsets
const CARDS = [
  {
    stage: 'Published',
    file: 'Brand_Guidelines_v2.pdf',
    owner: 'AL · 1.8 MB',
    icon: Globe,
    accent: '#8b5cf6',
    light: '#ede9fe',
    statusText: 'Published · visible to team',
    avatars: ['AL', 'SK', 'JR'],
    avColors: ['#8b5cf6', '#10b981', '#f59e0b'],
    // back-most card
    zOffset: -3,
    xOffset: 48,
    yOffset: -36,
    rot: 6,
  },
  {
    stage: 'Approved',
    file: 'Q4_Finance_Report_v2.pdf',
    owner: 'SK · 2.4 MB',
    icon: CheckCircle,
    accent: '#10b981',
    light: '#ecfdf5',
    statusText: 'Approved · all sign-offs done',
    avatars: ['SK', 'JR', 'MT'],
    avColors: ['#f59e0b', '#10b981', '#6366f1'],
    zOffset: -2,
    xOffset: 28,
    yOffset: -18,
    rot: 3,
  },
  {
    stage: 'In Review',
    file: 'Legal_NDA_Template_v3.pdf',
    owner: 'PM · 0.9 MB',
    icon: Eye,
    accent: '#3b82f6',
    light: '#eff6ff',
    statusText: 'In Review · step 2 of 3',
    avatars: ['PM', 'SK', 'AL'],
    avColors: ['#3b82f6', '#f59e0b', '#8b5cf6'],
    zOffset: -1,
    xOffset: 12,
    yOffset: -6,
    rot: 1,
  },
  {
    stage: 'Uploaded',
    file: 'Sales_Contract_Acme.docx',
    owner: 'JR · 3.1 MB',
    icon: Upload,
    accent: '#f59e0b',
    light: '#fef3c7',
    statusText: 'Uploaded · awaiting review',
    avatars: ['JR', 'MT', 'SK'],
    avColors: ['#f59e0b', '#6366f1', '#10b981'],
    // front card
    zOffset: 0,
    xOffset: 0,
    yOffset: 0,
    rot: -1,
  },
];

export default function Hero() {
  const heroRef   = useRef<HTMLElement>(null);
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);
  const mx = useSpring(rawMouseX, { stiffness: 40, damping: 22, mass: 1 });
  const my = useSpring(rawMouseY, { stiffness: 40, damping: 22, mass: 1 });

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
        style={{ background: 'radial-gradient(ellipse 60% 70% at 12% 55%, rgba(245,158,11,0.07) 0%, transparent 65%)' }} />

      <div className="relative w-full max-w-7xl mx-auto px-8 lg:px-16 py-24 pt-32 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {/* ── LEFT ── */}
        <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="flex flex-col gap-7 z-10">

          <motion.div variants={blurUp}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 uppercase tracking-widest">
              <Sparkles size={10} /> Document Management
            </span>
          </motion.div>

          <motion.h1 variants={blurUp}
            className="text-5xl sm:text-6xl lg:text-[4rem] font-black tracking-tight leading-[1.06] text-slate-900">
            One place for<br />
            <span className="text-gradient">all your</span><br />
            documents.
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg text-slate-500 leading-relaxed max-w-md">
            Qlarity keeps every file, approval, and version in one place — so nothing gets lost in email threads or shared drives.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
            {BADGES.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 bg-white text-slate-500 shadow-sm">
                <CheckCircle2 size={11} className="text-amber-500" /> {b}
              </span>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            <MagneticButton href="/register"
              className="shimmer-btn inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-4 rounded-2xl text-sm transition-colors shadow-lg shadow-amber-200/60 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              Start for Free <ArrowRight size={16} />
            </MagneticButton>
            <MagneticButton href="#how-it-works" strength={0.22}
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
              <Play size={13} className="text-amber-500 fill-amber-500" /> Watch Demo
            </MagneticButton>
          </motion.div>

          <motion.p variants={fadeUp} className="text-xs text-slate-400">
            No credit card required · Free to get started
          </motion.p>
        </motion.div>

        {/* ── RIGHT: layered 3D card stack ── */}
        <div className="relative flex items-center justify-center h-[480px]" style={{ perspective: 1000 }}>
          {CARDS.map((card, i) => (
            <DepthCard key={card.stage} card={card} index={i} mx={mx} my={my} total={CARDS.length} />
          ))}
        </div>
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

function DepthCard({ card, index, mx, my, total }: {
  card: typeof CARDS[number];
  index: number;
  mx: ReturnType<typeof useSpring>;
  my: ReturnType<typeof useSpring>;
  total: number;
}) {
  const Icon = card.icon;
  const isFront = index === total - 1;

  // Depth multiplier — back cards move more with mouse (parallax separation)
  const depth = (total - 1 - index) + 1;
  const rx = useTransform(my, [-1, 1], [depth * 5, -depth * 5]);
  const ry = useTransform(mx, [-1, 1], [-depth * 8, depth * 8]);
  // Lateral parallax — back cards shift more
  const px = useTransform(mx, [-1, 1], [-depth * 14, depth * 14]);
  const py = useTransform(my, [-1, 1], [-depth * 8, depth * 8]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.3 + (total - 1 - index) * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        x: px,
        y: py,
        rotateX: rx,
        rotateY: ry,
        translateX: card.xOffset,
        translateY: card.yOffset,
        rotate: card.rot,
        zIndex: index + 1,
      }}
      whileHover={isFront ? { scale: 1.03, transition: { duration: 0.25 } } : {}}
    >
      {/* Card */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{
          width: 300,
          boxShadow: isFront
            ? '0 24px 64px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)'
            : '0 12px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
          opacity: 1 - (total - 1 - index) * 0.08,
        }}
      >
        {/* Chrome bar */}
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 text-[9px] text-center text-slate-400">app.qlarity.io</div>
          <div className="text-[9px] font-bold px-2 py-0.5 rounded"
            style={{ background: card.light, color: card.accent }}>
            {card.stage.toUpperCase()}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {/* File */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: card.light }}>
              <FileText size={15} style={{ color: card.accent }} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">{card.file}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{card.owner}</div>
            </div>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold"
            style={{ background: card.light, color: card.accent }}>
            <Icon size={11} /> {card.statusText}
          </div>

          {/* Doc lines */}
          <div className="flex flex-col gap-1.5">
            {[100, 78, 90, 65].map((w, j) => (
              <div key={j} className="h-1.5 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <div className="flex -space-x-1.5">
              {card.avatars.map((a, j) => (
                <div key={a} className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-bold text-white"
                  style={{ background: card.avColors[j] }}>{a}</div>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-slate-400">
              <Clock size={9} /> 2m ago
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
