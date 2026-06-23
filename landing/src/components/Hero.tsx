import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationFrame,
  useSpring,
} from 'framer-motion';
import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  Play,
  CheckCircle,
  Eye,
  Clock,
  Globe,
  Upload,
  FileText,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { blurUp, fadeUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

// Orbital document cards — each orbits around the amber "sun"
const ORBIT_CARDS = [
  {
    file: 'Q4_Finance_Report.pdf',
    status: 'Approved',
    icon: CheckCircle,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.35)',
    rx: 210, ry: 88,
    start: 0.1,
    speed: 0.38,
  },
  {
    file: 'Legal_NDA_v3.pdf',
    status: 'In Review',
    icon: Eye,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.35)',
    rx: 165, ry: 65,
    start: 2.2,
    speed: -0.55,
  },
  {
    file: 'Brand_Guidelines.pdf',
    status: 'Published',
    icon: Globe,
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.35)',
    rx: 240, ry: 100,
    start: 3.8,
    speed: 0.28,
  },
  {
    file: 'Employee_Handbook.docx',
    status: 'Pending',
    icon: Clock,
    color: '#64748b',
    glow: 'rgba(100,116,139,0.25)',
    rx: 140, ry: 55,
    start: 1.0,
    speed: 0.72,
  },
  {
    file: 'Sales_Contract.docx',
    status: 'Uploaded',
    icon: Upload,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.3)',
    rx: 195, ry: 80,
    start: 4.5,
    speed: -0.44,
  },
  {
    file: 'Compliance_Policy.pdf',
    status: 'Approved',
    icon: CheckCircle,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.3)',
    rx: 125, ry: 48,
    start: 5.2,
    speed: -0.66,
  },
];

// Decorative orbital ring radii (visual only)
const RING_RADII = [130, 180, 235];

export default function Hero() {
  const heroRef   = useRef<HTMLElement>(null);
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);
  const mx = useSpring(rawMouseX, { stiffness: 28, damping: 22, mass: 1 });
  const my = useSpring(rawMouseY, { stiffness: 28, damping: 22, mass: 1 });

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

  // Parallax shift of the whole orbit system with mouse
  const orbitX = useTransform(mx, [-1, 1], [-18, 18]);
  const orbitY = useTransform(my, [-1, 1], [-10, 10]);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden min-h-screen flex items-center"
      style={{ background: '#070d1a' }}
    >
      {/* Stars / particle field */}
      <Stars />

      {/* Subtle grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Bottom fade to next section */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #070d1a)' }}
      />

      <div className="relative w-full max-w-7xl mx-auto px-8 lg:px-16 py-24 pt-32 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* ── LEFT: Copy ───────────────────────────────── */}
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-7 z-10"
        >
          <motion.div variants={blurUp}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-400 uppercase tracking-widest">
              <Sparkles size={10} /> Document Management
            </span>
          </motion.div>

          <motion.h1
            variants={blurUp}
            className="text-5xl sm:text-6xl lg:text-[4rem] font-black tracking-tight leading-[1.06] text-white"
          >
            One place for<br />
            <span style={{
              background: 'linear-gradient(90deg, #f59e0b 0%, #fcd34d 50%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              all your
            </span><br />
            documents.
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg text-slate-400 leading-relaxed max-w-md">
            Qlarity keeps every file, approval, and version in one place — so nothing gets lost in email threads or shared drives.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
            {BADGES.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-700 bg-slate-800/60 text-slate-400">
                <CheckCircle2 size={11} className="text-amber-500" /> {b}
              </span>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            <MagneticButton
              href="/register"
              className="shimmer-btn inline-flex items-center gap-2 font-bold px-8 py-4 rounded-2xl text-sm transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', boxShadow: '0 0 32px rgba(245,158,11,0.45), 0 8px 24px rgba(249,115,22,0.3)' }}
            >
              Start for Free <ArrowRight size={16} />
            </MagneticButton>
            <MagneticButton
              href="#how-it-works"
              strength={0.22}
              className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-2xl text-sm border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white transition-all"
            >
              <Play size={13} className="text-amber-500 fill-amber-500" /> Watch Demo
            </MagneticButton>
          </motion.div>

          <motion.p variants={fadeUp} className="text-xs text-slate-600">
            No credit card required · Free to get started
          </motion.p>
        </motion.div>

        {/* ── RIGHT: Orbital system ─────────────────────── */}
        <div className="relative h-[500px] lg:h-[580px] flex items-center justify-center">
          <motion.div
            style={{ x: orbitX, y: orbitY }}
            className="relative w-full h-full flex items-center justify-center"
          >
            {/* Orbital rings */}
            {RING_RADII.map((r, i) => (
              <motion.div
                key={r}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute rounded-full"
                style={{
                  width: r * 2,
                  height: r * 0.82 * 2,
                  border: '1px solid rgba(245,158,11,0.1)',
                  boxShadow: `0 0 0 1px rgba(245,158,11,0.04)`,
                }}
              />
            ))}

            {/* Amber sun / orb */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative flex items-center justify-center"
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'radial-gradient(circle at 38% 35%, #fcd34d, #f59e0b 55%, #d97706)',
                  boxShadow: '0 0 60px rgba(245,158,11,0.7), 0 0 120px rgba(245,158,11,0.35), 0 0 200px rgba(245,158,11,0.15)',
                }}
              >
                <span className="text-[10px] font-black text-amber-900 tracking-tight">qlarity</span>
              </motion.div>
            </motion.div>

            {/* Orbiting document cards */}
            {ORBIT_CARDS.map((card, i) => (
              <OrbitCard key={card.file} card={card} index={i} />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
      >
        <span className="text-xs text-slate-600">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 rounded-full border border-slate-700 flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-2 bg-amber-500/50 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// Each card runs its own animation frame — no re-renders
function OrbitCard({ card, index }: { card: typeof ORBIT_CARDS[number]; index: number }) {
  const Icon = card.icon;
  const angle = useMotionValue(card.start);

  useAnimationFrame((t) => {
    angle.set(card.start + (t / 1000) * card.speed);
  });

  const x = useTransform(angle, (a) => card.rx * Math.cos(a));
  const y = useTransform(angle, (a) => card.ry * Math.sin(a));
  // Cards in "front" (positive y offset) → full opacity & scale; behind → dim & small
  const opacity = useTransform(angle, (a) => 0.35 + 0.65 * ((Math.sin(a) + 1) / 2));
  const scale   = useTransform(angle, (a) => 0.78 + 0.22 * ((Math.sin(a) + 1) / 2));
  const zIndex  = useTransform(angle, (a) => Math.sin(a) > 0 ? 10 : 2);
  const blur    = useTransform(angle, (a) => `blur(${Math.max(0, -Math.sin(a) * 1.2)}px)`);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5 + index * 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        x, y,
        opacity,
        scale,
        zIndex,
        filter: blur,
        translateX: '-50%',
        translateY: '-50%',
      }}
    >
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 select-none"
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${card.color}40`,
          boxShadow: `0 0 20px ${card.glow}, 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
          minWidth: 170,
        }}
      >
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${card.color}18`, border: `1px solid ${card.color}30` }}
        >
          <FileText size={12} style={{ color: card.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-slate-300 truncate leading-tight">{card.file}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <Icon size={8} style={{ color: card.color }} />
            <span className="text-[9px] font-bold" style={{ color: card.color }}>{card.status}</span>
          </div>
        </div>
        {/* Pulse dot */}
        <div className="relative flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: card.color }} />
          <motion.div
            animate={{ scale: [1, 2.5, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full"
            style={{ background: card.color }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Scattered star particles
function Stars() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 4,
    dur: 2.5 + Math.random() * 3,
  }));

  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map((s) => (
        <motion.div
          key={s.id}
          animate={{ opacity: [0.1, 0.7, 0.1] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
        />
      ))}
    </div>
  );
}
