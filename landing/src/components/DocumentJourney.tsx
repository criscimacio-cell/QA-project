import { motion, useScroll, useTransform, useSpring, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import { Upload, Eye, CheckCircle2, Globe, FileText, MessageSquare, Shield, Clock } from 'lucide-react';

const STAGES = [
  {
    tag: 'Upload',
    headline: 'Drop it in.',
    sub: 'Any file type, instantly organized.',
    accent: '#f59e0b',
    light: '#fef3c7',
    icon: Upload,
    floaters: [
      { label: 'Drag & drop', icon: Upload, side: 'left',  color: '#f59e0b' },
      { label: 'v1 saved',   icon: FileText, side: 'right', color: '#94a3b8' },
    ],
  },
  {
    tag: 'Review',
    headline: 'Team weighs in.',
    sub: 'Comments, annotations, sign-offs — all in one thread.',
    accent: '#f59e0b',
    light: '#fef3c7',
    icon: Eye,
    floaters: [
      { label: '3 comments',  icon: MessageSquare, side: 'right', color: '#f59e0b' },
      { label: 'Reviewing…',  icon: Eye,           side: 'left',  color: '#f59e0b' },
    ],
  },
  {
    tag: 'Approved',
    headline: 'Signed off.',
    sub: 'Every stakeholder confirmed. Audit trail locked.',
    accent: '#10b981',
    light: '#ecfdf5',
    icon: CheckCircle2,
    floaters: [
      { label: 'Approved ✓', icon: CheckCircle2, side: 'left',  color: '#10b981' },
      { label: 'Audit logged', icon: Shield,      side: 'right', color: '#10b981' },
    ],
  },
  {
    tag: 'Published',
    headline: 'Live for your team.',
    sub: 'Access controlled. Nothing slips through.',
    accent: '#8b5cf6',
    light: '#ede9fe',
    icon: Globe,
    floaters: [
      { label: 'Live now',    icon: Globe,  side: 'right', color: '#8b5cf6' },
      { label: 'Access set',  icon: Shield, side: 'left',  color: '#8b5cf6' },
    ],
  },
];

function DocMockup({ stage }: { stage: number }) {
  const s = STAGES[stage];
  const Icon = s.icon;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden w-72 select-none">
      {/* Chrome */}
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-2 text-[9px] text-center text-slate-400">app.qlarity.io</div>
      </div>

      <div className="p-4 flex flex-col gap-3 relative">
        {/* File header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <FileText size={15} className="text-amber-500" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-800">Q4_Finance_Report_v2.pdf</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Sarah K. · 2.4 MB</div>
          </div>
        </div>

        {/* Status badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold"
            style={{ background: s.light, color: s.accent }}
          >
            <Icon size={10} /> {s.tag}
          </motion.div>
        </AnimatePresence>

        {/* Document lines */}
        <div className="flex flex-col gap-1.5">
          {[100, 82, 94, 68, 88, 76].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
          ))}
        </div>

        {/* Comments — stage 1+ */}
        <AnimatePresence>
          {stage >= 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden border-t border-slate-100 pt-2 flex flex-col gap-1.5"
            >
              {[
                { a: 'JR', text: 'Verify Q3 figures please', c: '#f59e0b' },
                { a: 'SK', text: 'Updated — looks good ✓', c: '#10b981' },
              ].map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0"
                    style={{ background: c.c }}>{c.a}</div>
                  <span className="text-[9px] text-slate-500">{c.text}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Approved stamp — stage 2+ */}
        <AnimatePresence>
          {stage >= 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: -8 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 280, damping: 16 }}
              className="absolute top-20 right-3 border-2 border-emerald-500 rounded-lg px-2.5 py-1 pointer-events-none"
              style={{ background: 'rgba(236,253,245,0.92)' }}
            >
              <span className="text-[9px] font-black text-emerald-600 tracking-widest uppercase">✓ Approved</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Published globe — stage 3 */}
        <AnimatePresence>
          {stage === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5"
            >
              <Globe size={10} className="text-violet-500" />
              <span className="text-[10px] font-semibold text-violet-700">Published · visible to team</span>
              <span className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[8px] text-violet-400">Live</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div className="flex -space-x-1.5">
            {['SK','JR','MT'].map((a, i) => (
              <div key={a} className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[7px] font-bold text-white"
                style={{ background: ['#f59e0b','#10b981','#6366f1'][i] }}>{a}</div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-slate-400">
            <Clock size={9} /> 2m ago
          </div>
        </div>
      </div>
    </div>
  );
}

function Floaters({ stage }: { stage: number }) {
  const floaters = STAGES[stage].floaters;
  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {floaters.map((f, i) => {
          const Icon = f.icon;
          const isLeft = f.side === 'left';
          return (
            <motion.div
              key={`${stage}-${i}`}
              initial={{ opacity: 0, x: isLeft ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLeft ? -24 : 24 }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bg-white border rounded-xl px-3 py-2 shadow-md flex items-center gap-1.5 text-[10px] font-semibold whitespace-nowrap"
              style={{
                borderColor: `${f.color}40`,
                color: f.color,
                [isLeft ? 'right' : 'left']: '105%',
                top: i === 0 ? '20%' : '65%',
              }}
            >
              <Icon size={11} style={{ color: f.color }} /> {f.label}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default function DocumentJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Document flows DOWN on scroll, UP on scroll back — scrubbed directly
  const rawY   = useTransform(scrollYProgress, [0, 1], [-100, 100]);
  const rawRot = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [-7, -1, 3, 6]);
  const rawScale = useTransform(scrollYProgress, [0, 0.08, 0.92, 1], [0.85, 1, 1, 0.88]);

  const docY   = useSpring(rawY,     { stiffness: 50, damping: 20, mass: 1.3 });
  const docRot = useSpring(rawRot,   { stiffness: 50, damping: 20, mass: 1.3 });
  const docSc  = useSpring(rawScale, { stiffness: 50, damping: 20, mass: 1.3 });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setStage(v < 0.28 ? 0 : v < 0.54 ? 1 : v < 0.78 ? 2 : 3);
  });

  const s = STAGES[stage];

  return (
    <section className="relative bg-[#FAFAFA]">
      <div ref={containerRef} className="relative h-[380vh]">
        <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">

          {/* Shifting bg glow per stage */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${s.accent}09 0%, transparent 70%)` }}
            transition={{ duration: 0.8 }}
            aria-hidden="true"
          />
          <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

          {/* Top + bottom fades */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#FAFAFA] to-transparent pointer-events-none" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#FAFAFA] to-transparent pointer-events-none" />

          <div className="relative w-full max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

            {/* ── Left: scroll-scrubbed document ── */}
            <div className="flex items-center justify-center" style={{ height: 420 }}>
              <motion.div
                style={{ y: docY, rotate: docRot, scale: docSc }}
                className="relative"
              >
                <Floaters stage={stage} />
                <DocMockup stage={stage} />
              </motion.div>
            </div>

            {/* ── Right: stage copy ── */}
            <div className="flex flex-col gap-6">
              {/* Stage indicator pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {STAGES.map((st, i) => (
                  <motion.div
                    key={st.tag}
                    animate={{
                      background: i === stage ? st.accent : '#f1f5f9',
                      color: i === stage ? '#fff' : '#94a3b8',
                      scale: i === stage ? 1.05 : 1,
                    }}
                    transition={{ duration: 0.35 }}
                    className="text-[10px] font-bold px-3 py-1 rounded-full"
                  >
                    {String(i + 1).padStart(2,'0')} {st.tag}
                  </motion.div>
                ))}
              </div>

              {/* Headline */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-3">
                    {s.headline}
                  </h2>
                  <p className="text-xl text-slate-500 leading-relaxed max-w-sm">{s.sub}</p>
                </motion.div>
              </AnimatePresence>

              {/* Progress bar */}
              <div className="flex gap-2 mt-2">
                {STAGES.map((_, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full origin-left"
                      animate={{ scaleX: i <= stage ? 1 : 0, background: s.accent }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                ))}
              </div>

              {/* Scroll hint */}
              <AnimatePresence>
                {stage < 3 && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-xs text-slate-400"
                  >
                    <motion.div
                      animate={{ y: [0, 5, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-4 h-6 rounded-full border border-slate-200 flex items-start justify-center pt-1"
                    >
                      <div className="w-0.5 h-1.5 rounded-full" style={{ background: s.accent }} />
                    </motion.div>
                    Scroll to continue
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
