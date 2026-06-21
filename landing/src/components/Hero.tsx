import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles, FileText, CheckCircle, Clock, Upload, Eye, Send } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

// Live document event feed — realistic DMS activity stream
const EVENTS = [
  { icon: CheckCircle, label: 'approved',   color: '#10b981', user: 'Sarah K.',    file: 'Q4_Finance_Report_v2.pdf' },
  { icon: Send,        label: 'sent for review', color: '#f59e0b', user: 'Mike T.',  file: 'Employee_Handbook_2025.docx' },
  { icon: Upload,      label: 'uploaded',   color: '#6366f1', user: 'Priya M.',    file: 'Legal_NDA_Template_v3.pdf' },
  { icon: Eye,         label: 'viewed',     color: '#64748b', user: 'James R.',    file: 'Product_Roadmap_Draft.pptx' },
  { icon: CheckCircle, label: 'published',  color: '#10b981', user: 'Sarah K.',    file: 'Compliance_Policy_2025.pdf' },
  { icon: Clock,       label: 'pending review', color: '#f59e0b', user: 'Ana L.', file: 'Sales_Contract_Acme.docx' },
  { icon: FileText,    label: 'version 4 saved', color: '#6366f1', user: 'Tom B.', file: 'Architecture_Overview.pdf' },
  { icon: Send,        label: 'sent for review', color: '#f59e0b', user: 'Priya M.', file: 'Brand_Guidelines_v2.pdf' },
  { icon: CheckCircle, label: 'approved',   color: '#10b981', user: 'James R.',    file: 'Invoice_Oct_2025.xlsx' },
  { icon: Upload,      label: 'uploaded',   color: '#6366f1', user: 'Ana L.',      file: 'HR_Policy_Update.docx' },
  { icon: Eye,         label: 'viewed',     color: '#64748b', user: 'Mike T.',     file: 'Onboarding_Checklist.pdf' },
  { icon: CheckCircle, label: 'published',  color: '#10b981', user: 'Tom B.',      file: 'Release_Notes_v3.2.pdf' },
  { icon: Clock,       label: 'awaiting signature', color: '#f59e0b', user: 'Sarah K.', file: 'Partnership_Agreement.pdf' },
  { icon: FileText,    label: 'commented',  color: '#6366f1', user: 'James R.',    file: 'UX_Research_Report.pdf' },
  { icon: Send,        label: 'escalated',  color: '#ef4444', user: 'Priya M.',    file: 'Budget_Forecast_Q1.xlsx' },
  { icon: CheckCircle, label: 'approved',   color: '#10b981', user: 'Ana L.',      file: 'Vendor_Contract_Dell.pdf' },
];

// Split events into columns with offsets so columns feel independent
const COL_1 = [...EVENTS.slice(0, 8),  ...EVENTS.slice(0, 8)];
const COL_2 = [...EVENTS.slice(5, 13), ...EVENTS.slice(5, 13)];
const COL_3 = [...EVENTS.slice(8, 16), ...EVENTS.slice(8, 16)];
const COL_4 = [...EVENTS.slice(2, 10), ...EVENTS.slice(2, 10)];

function EventCard({ e }: { e: typeof EVENTS[number] }) {
  const Icon = e.icon;
  return (
    <div className="flex items-start gap-2.5 bg-white/70 backdrop-blur-sm border border-slate-100 rounded-xl px-3 py-2.5 mb-2 shadow-sm"
      style={{ minWidth: 220 }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${e.color}18` }}>
        <Icon size={11} style={{ color: e.color }} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium text-slate-700 truncate" style={{ fontFamily: 'system-ui' }}>
          {e.file}
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5" style={{ fontFamily: 'system-ui' }}>
          <span style={{ color: e.color, fontWeight: 600 }}>{e.label}</span>
          {' '}by {e.user} · just now
        </div>
      </div>
    </div>
  );
}

function StreamColumn({ events, duration, delay = 0, className = '' }: {
  events: typeof EVENTS;
  duration: number;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height: '100%' }}>
      <motion.div
        animate={{ y: ['0%', '-50%'] }}
        transition={{ duration, delay, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
        style={{ willChange: 'transform' }}
      >
        {events.map((e, i) => <EventCard key={i} e={e} />)}
      </motion.div>
    </div>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  const mouseX  = useMotionValue(50);
  const mouseY  = useMotionValue(50);
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 18 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 18 });
  const spotlightBg = useMotionTemplate`radial-gradient(600px circle at ${smoothX}% ${smoothY}%, rgba(245,158,11,0.07), transparent 65%)`;

  useEffect(() => {
    const el = spotlightRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouseX.set(((e.clientX - rect.left) / rect.width) * 100);
      mouseY.set(((e.clientY - rect.top) / rect.height) * 100);
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, [mouseX, mouseY]);

  return (
    <section ref={ref} className="relative overflow-hidden min-h-screen flex items-center">

      {/* ── Live stream background ───────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Grid */}
        <div className="absolute inset-0 grid-bg opacity-40" />

        {/* Event columns — 4 columns, different speeds */}
        <div className="absolute inset-0 flex gap-3 px-4 pt-16"
          style={{ opacity: 0.55 }}>
          <StreamColumn events={COL_1} duration={28} delay={0}   className="flex-1" />
          <StreamColumn events={COL_2} duration={22} delay={-6}  className="flex-1" />
          <StreamColumn events={COL_3} duration={32} delay={-12} className="flex-1" />
          <StreamColumn events={COL_4} duration={26} delay={-4}  className="flex-1 hidden xl:block" />
        </div>

        {/* Fade overlays — top/bottom gradient so stream fades in/out */}
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#FAFAFA] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#FAFAFA] to-transparent" />

        {/* Center radial clear zone so text pops against stream */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(70% 65% at 50% 50%, rgba(250,250,250,0.96) 0%, rgba(250,250,250,0.7) 55%, transparent 100%)' }} />
      </div>

      {/* Cursor spotlight */}
      <div ref={spotlightRef} className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <motion.div className="absolute inset-0" style={{ background: spotlightBg }} />
      </div>

      {/* ── Hero content ─────────────────────────────────────── */}
      <div className="relative w-full max-w-5xl mx-auto px-6 py-32 pt-36 flex flex-col items-center gap-7 text-center">
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

          <motion.h1 variants={blurUp} aria-label="One place for all your documents."
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.12]">
            <span className="text-slate-900">Your team's documents,</span>
            <br />
            <span className="text-gradient">finally under control.</span>
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
            Live activity from teams using Qlarity right now
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
