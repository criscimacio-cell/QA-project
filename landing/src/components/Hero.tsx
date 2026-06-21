import { motion, useMotionValue, useSpring, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles, FileText, CheckCircle, Clock, AlertCircle, XCircle, FolderOpen, Search, Bell, Users, Filter, Plus } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

// ── Chaos side — scattered, overlapping document cards ───────────────────────
const CHAOS_DOCS = [
  { name: 'Final_FINAL_v3_REAL.docx', status: 'overdue', color: '#ef4444', icon: XCircle,     rot: -8,  x: '6%',   y: '8%',  z: 6 },
  { name: 'Contract_draft copy(2).pdf', status: 'lost',  color: '#f97316', icon: AlertCircle, rot: 5,   x: '30%',  y: '4%',  z: 4 },
  { name: 'Report_FINAL(1).xlsx',       status: 'overdue', color: '#ef4444', icon: XCircle,   rot: -3,  x: '55%',  y: '11%', z: 5 },
  { name: 'NDA_unsigned????.pdf',       status: 'lost',  color: '#f97316', icon: AlertCircle, rot: 9,   x: '10%',  y: '34%', z: 3 },
  { name: 'Budget v7 LATEST.xlsx',      status: 'overdue', color: '#ef4444', icon: XCircle,   rot: -6,  x: '38%',  y: '28%', z: 7 },
  { name: 'Slide_deck_USE THIS.pptx',   status: 'lost',  color: '#f97316', icon: AlertCircle, rot: 4,   x: '62%',  y: '36%', z: 2 },
  { name: 'Policy_old_2022.pdf',        status: 'overdue', color: '#ef4444', icon: XCircle,   rot: -11, x: '5%',   y: '60%', z: 8 },
  { name: 'Invoice_Oct_final2.pdf',     status: 'lost',  color: '#f97316', icon: AlertCircle, rot: 7,   x: '42%',  y: '58%', z: 5 },
  { name: 'Contract_v12_send.docx',     status: 'overdue', color: '#ef4444', icon: XCircle,   rot: -4,  x: '20%',  y: '74%', z: 3 },
  { name: 'Roadmap_DRAFT_old.pptx',     status: 'lost',  color: '#f97316', icon: AlertCircle, rot: 6,   x: '58%',  y: '70%', z: 6 },
];

// ── Clarity side — clean organized grid rows ─────────────────────────────────
const CLARITY_DOCS = [
  { name: 'Q4_Finance_Report_v2.pdf',    status: 'Published',  color: '#10b981', icon: CheckCircle },
  { name: 'Employee_Handbook_2025.docx', status: 'In Review',  color: '#f59e0b', icon: Clock },
  { name: 'Legal_NDA_Template_v3.pdf',   status: 'Published',  color: '#10b981', icon: CheckCircle },
  { name: 'Sales_Contract_Acme.docx',    status: 'In Review',  color: '#f59e0b', icon: Clock },
  { name: 'Brand_Guidelines_v2.pdf',     status: 'Published',  color: '#10b981', icon: CheckCircle },
  { name: 'Compliance_Policy_2025.pdf',  status: 'Published',  color: '#10b981', icon: CheckCircle },
];

function ChaosCard({ doc, revealX }: { doc: typeof CHAOS_DOCS[number]; revealX: number }) {
  const Icon = doc.icon;
  // Cards on the left disappear as the sweep passes through them
  const cardCenterX = parseFloat(doc.x) + 18; // approximate center
  const opacity = revealX > cardCenterX ? 0 : 1;

  return (
    <div
      className="absolute bg-white border-2 rounded-lg px-3 py-2.5 shadow-lg"
      style={{
        left: doc.x, top: doc.y,
        transform: `rotate(${doc.rot}deg)`,
        zIndex: doc.z,
        borderColor: doc.color,
        minWidth: 180, maxWidth: 210,
        opacity,
        transition: 'opacity 0.4s ease',
        willChange: 'opacity',
      }}
    >
      <div className="flex items-center gap-2">
        <Icon size={12} style={{ color: doc.color, flexShrink: 0 }} />
        <span className="text-[10px] font-medium text-slate-700 truncate">{doc.name}</span>
      </div>
      <div className="mt-1 text-[9px] font-semibold" style={{ color: doc.color }}>{doc.status.toUpperCase()}</div>
    </div>
  );
}

function ClarityPanel({ revealX }: { revealX: number }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ clipPath: `inset(0 0 0 ${revealX}%)` }}>
      {/* App chrome */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 text-center text-[10px] text-slate-400 font-medium">app.qlarity.io</div>
        <Bell size={11} className="text-slate-500" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-36 bg-slate-800 flex-shrink-0 p-3 flex flex-col gap-1">
          <div className="text-[8px] font-bold text-amber-400 mb-2 uppercase tracking-wider">Qlarity</div>
          {[
            { icon: FolderOpen, label: 'Documents', active: true },
            { icon: Users,      label: 'Team',      active: false },
            { icon: CheckCircle, label: 'Approvals', active: false },
            { icon: Search,     label: 'Search',    active: false },
          ].map(({ icon: Icon, label, active }) => (
            <div key={label} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[9px] font-medium ${active ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400'}`}>
              <Icon size={10} /> {label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 bg-slate-50 p-3 flex flex-col gap-2 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-[9px] text-slate-400 flex items-center gap-1.5">
              <Search size={9} /> Search documents…
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1 text-[9px] text-slate-500">
              <Filter size={9} /> Filter
            </div>
            <div className="flex items-center gap-1 bg-amber-500 rounded-md px-2 py-1 text-[9px] text-white font-medium">
              <Plus size={9} /> New
            </div>
          </div>

          {/* Document rows */}
          <div className="flex flex-col gap-1 flex-1">
            {/* Header */}
            <div className="grid gap-2 px-2 py-1 text-[8px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200"
              style={{ gridTemplateColumns: '1fr 70px 60px' }}>
              <span>Name</span><span>Status</span><span>Updated</span>
            </div>
            {CLARITY_DOCS.map((doc, i) => {
              const Icon = doc.icon;
              return (
                <div
                  key={doc.name}
                  className="grid gap-2 px-2 py-1.5 rounded-md bg-white border border-slate-100 items-center hover:border-amber-200 transition-colors"
                  style={{ gridTemplateColumns: '1fr 70px 60px', opacity: revealX > 0 ? 1 : 0, transition: `opacity 0.3s ease ${i * 0.06}s` }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={10} className="text-slate-400 flex-shrink-0" />
                    <span className="text-[9px] font-medium text-slate-700 truncate">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon size={9} style={{ color: doc.color }} />
                    <span className="text-[9px] font-medium" style={{ color: doc.color }}>{doc.status}</span>
                  </div>
                  <span className="text-[9px] text-slate-400">2h ago</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  // revealX: percentage (0–100) of the sweep line's horizontal position
  const revealProgress = useMotionValue(0);
  const smoothReveal  = useSpring(revealProgress, { stiffness: 40, damping: 18 });
  const [revealX, setRevealX] = useState(0);

  useEffect(() => {
    // Auto-animate: sweep from 0 → 100 over ~3.5 s, pause, then reset and repeat
    let stopped = false;
    const run = async () => {
      while (!stopped) {
        await new Promise(r => setTimeout(r, 900));
        await animate(revealProgress, 100, { duration: 3.5, ease: [0.4, 0, 0.2, 1] });
        await new Promise(r => setTimeout(r, 1800));
        await animate(revealProgress, 0, { duration: 0.01, ease: 'linear' });
      }
    };
    run();
    return () => { stopped = true; };
  }, [revealProgress]);

  useEffect(() => {
    return smoothReveal.on('change', v => setRevealX(v));
  }, [smoothReveal]);

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center bg-[#FAFAFA]">

      {/* ── Hero content ─────────────────────────────────────── */}
      <div className="relative w-full max-w-6xl mx-auto px-6 py-32 pt-36 flex flex-col items-center gap-10 text-center">
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

          <motion.h1 variants={blurUp} aria-label="Your team's documents, finally under control."
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.12]">
            <span className="text-slate-900">Stop the chaos.</span>
            <br />
            <span className="text-gradient">Start with clarity.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="max-w-xl text-lg sm:text-xl text-slate-500 leading-relaxed">
            Qlarity replaces scattered files, lost approvals, and version confusion with one clean, organized workspace your whole team can trust.
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

        {/* ── Split mockup ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl relative"
          style={{ perspective: 1000 }}
        >
          <motion.div
            animate={{ rotateX: [2, 0], rotateY: [0, 0] }}
            transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl"
            style={{ aspectRatio: '16/9', background: '#f8f8f8', transformStyle: 'flat' }}
          >
            {/* ── CHAOS side (left) — pale red wash ── */}
            <div className="absolute inset-0 bg-red-50/60" />

            {/* Chaos label */}
            <div
              className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-red-200 rounded-full px-3 py-1 shadow-sm"
              style={{ opacity: revealX > 15 ? 0 : 1, transition: 'opacity 0.4s ease' }}
            >
              <XCircle size={12} className="text-red-500" />
              <span className="text-[10px] font-semibold text-red-600">Before Qlarity</span>
            </div>

            {/* Scattered chaos cards */}
            {CHAOS_DOCS.map((doc) => (
              <ChaosCard key={doc.name} doc={doc} revealX={revealX} />
            ))}

            {/* Email thread indicator (chaos) */}
            <div
              className="absolute bottom-4 left-4 z-10 bg-white/90 border border-orange-200 rounded-lg px-3 py-2 shadow-sm"
              style={{ opacity: revealX > 10 ? 0 : 1, transition: 'opacity 0.3s ease' }}
            >
              <div className="text-[9px] font-semibold text-orange-600 mb-0.5">📧 RE: RE: RE: Final version?</div>
              <div className="text-[8px] text-slate-500">Which file is the latest one??</div>
            </div>

            {/* ── CLARITY side — revealed by sweep ── */}
            <ClarityPanel revealX={revealX} />

            {/* Clarity label */}
            <div
              className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-emerald-200 rounded-full px-3 py-1 shadow-sm"
              style={{ opacity: revealX > 85 ? 1 : 0, transition: 'opacity 0.4s ease' }}
            >
              <CheckCircle size={12} className="text-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-600">With Qlarity</span>
            </div>

            {/* ── Sweep line ── */}
            <motion.div
              className="absolute inset-y-0 z-40 flex items-center"
              style={{ left: `${revealX}%`, transform: 'translateX(-50%)' }}
            >
              {/* Glow line */}
              <div className="w-0.5 h-full bg-gradient-to-b from-transparent via-amber-400 to-transparent shadow-[0_0_12px_3px_rgba(245,158,11,0.6)]" />
              {/* Handle knob */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white border-2 border-amber-400 rounded-full shadow-lg flex items-center justify-center">
                <div className="flex gap-0.5">
                  <div className="w-0.5 h-3 bg-amber-400 rounded-full" />
                  <div className="w-0.5 h-3 bg-amber-400 rounded-full" />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Caption */}
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              Scattered &amp; untracked
            </span>
            <span className="w-4 border-t border-slate-200" />
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Organized with Qlarity
            </span>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div aria-hidden="true"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
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
