import { motion, useScroll, useTransform, useSpring, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import { Upload, Eye, CheckCircle2, Globe, FileText, Clock } from 'lucide-react';

const STAGES = [
  {
    tag: 'Upload',
    headline: 'Drop it in.',
    sub: 'Any file type, instantly organized.',
    accent: '#f59e0b',
    light: '#fef3c7',
    icon: Upload,
    statusLabel: 'Uploaded · awaiting review',
    statusBg: '#fef3c7',
    statusColor: '#d97706',
  },
  {
    tag: 'Review',
    headline: 'Team weighs in.',
    sub: 'Comments, annotations, sign-offs — all in one place.',
    accent: '#3b82f6',
    light: '#eff6ff',
    icon: Eye,
    statusLabel: 'In Review · step 2 of 3',
    statusBg: '#eff6ff',
    statusColor: '#2563eb',
  },
  {
    tag: 'Approved',
    headline: 'Signed off.',
    sub: 'Every stakeholder confirmed. Audit trail locked.',
    accent: '#10b981',
    light: '#ecfdf5',
    icon: CheckCircle2,
    statusLabel: 'Approved · all sign-offs done',
    statusBg: '#ecfdf5',
    statusColor: '#059669',
  },
  {
    tag: 'Published',
    headline: 'Live for your team.',
    sub: 'Access controlled. Nothing slips through.',
    accent: '#8b5cf6',
    light: '#ede9fe',
    icon: Globe,
    statusLabel: 'Published · visible to team',
    statusBg: '#ede9fe',
    statusColor: '#7c3aed',
  },
];

const CARD_COUNT = STAGES.length;
// Radius of the carousel cylinder in px
const RADIUS = 420;

function DocCard({ index, active }: { index: number; active: boolean }) {
  const s = STAGES[index];
  const Icon = s.icon;

  return (
    <motion.div
      animate={{ opacity: active ? 1 : 0.35, scale: active ? 1 : 0.88 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden select-none"
      style={{ width: 300 }}
    >
      {/* Chrome */}
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-2 text-[9px] text-center text-slate-400">app.qlarity.io</div>
        <motion.div
          animate={{ background: s.light, color: s.accent }}
          className="text-[9px] font-bold px-2 py-0.5 rounded"
        >
          {s.tag.toUpperCase()}
        </motion.div>
      </div>

      <div className="p-4 flex flex-col gap-3 relative">
        {/* File header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: s.light }}>
            <FileText size={15} style={{ color: s.accent }} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-800">Q4_Finance_Report_v2.pdf</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Sarah K. · 2.4 MB</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold"
          style={{ background: s.light, color: s.accent }}>
          <Icon size={10} /> {s.statusLabel}
        </div>

        {/* Doc lines */}
        <div className="flex flex-col gap-1.5">
          {[100, 80, 92, 68, 86].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
          ))}
        </div>

        {/* Comments for review+ */}
        {index >= 1 && (
          <div className="border-t border-slate-100 pt-2 flex flex-col gap-1.5">
            {[
              { a: 'JR', text: 'Verify Q3 figures please', c: '#f59e0b' },
              { a: 'SK', text: 'Updated — looks good ✓', c: '#10b981' },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0"
                  style={{ background: c.c }}>{c.a}</div>
                <span className="text-[9px] text-slate-500">{c.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Approved stamp */}
        {index >= 2 && (
          <div className="absolute top-20 right-3 border-2 border-emerald-500 rounded-lg px-2.5 py-1"
            style={{ background: 'rgba(236,253,245,0.95)', transform: 'rotate(-8deg)' }}>
            <span className="text-[9px] font-black text-emerald-600 tracking-widest uppercase">✓ Approved</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div className="flex -space-x-1.5">
            {['SK', 'JR', 'MT'].map((a, i) => (
              <div key={a} className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[7px] font-bold text-white"
                style={{ background: ['#f59e0b', '#10b981', '#6366f1'][i] }}>{a}</div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-slate-400">
            <Clock size={9} /> 2m ago
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function DocumentJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Rotate the carousel: each stage = 90deg turn
  // scrollYProgress 0→1 maps to 0→ -(CARD_COUNT-1)*90 deg
  const rawRotY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, -(CARD_COUNT - 1) * 90]
  );
  const carouselRotY = useSpring(rawRotY, { stiffness: 55, damping: 22, mass: 1.2 });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.min(
      CARD_COUNT - 1,
      Math.round(v * (CARD_COUNT - 1))
    );
    setActiveStage(idx);
  });

  const s = STAGES[activeStage];

  return (
    <section className="relative bg-[#FAFAFA]">
      <div ref={containerRef} className="relative h-[400vh]">
        <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">

          {/* Shifting bg glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ background: `radial-gradient(ellipse 60% 50% at 40% 50%, ${s.accent}0c 0%, transparent 70%)` }}
            transition={{ duration: 0.8 }}
            aria-hidden="true"
          />
          <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

          <div className="relative w-full max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

            {/* ── 3D rotating carousel ── */}
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 340, height: 460 }}>
              <div style={{ perspective: 1100 }}>
                <motion.div
                  style={{
                    rotateY: carouselRotY,
                    transformStyle: 'preserve-3d',
                    width: 300,
                    height: 420,
                    position: 'relative',
                  }}
                >
                  {STAGES.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        transformStyle: 'preserve-3d',
                        transform: `rotateY(${i * 90}deg) translateZ(${RADIUS}px)`,
                        backfaceVisibility: 'hidden',
                      }}
                    >
                      <DocCard index={i} active={activeStage === i} />
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* ── Right: stage copy ── */}
            <div className="flex flex-col gap-6 flex-1 max-w-lg">
              {/* Stage pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {STAGES.map((st, i) => (
                  <motion.div
                    key={st.tag}
                    animate={{
                      background: i === activeStage ? s.accent : i < activeStage ? `${s.accent}30` : '#f1f5f9',
                      color: i === activeStage ? '#fff' : i < activeStage ? s.accent : '#94a3b8',
                      scale: i === activeStage ? 1.05 : 1,
                    }}
                    transition={{ duration: 0.35 }}
                    className="text-[10px] font-bold px-3 py-1 rounded-full"
                  >
                    {String(i + 1).padStart(2, '0')} {st.tag}
                  </motion.div>
                ))}
              </div>

              {/* Headline */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStage}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-3">
                    {s.headline}
                  </h2>
                  <p className="text-xl text-slate-500 leading-relaxed">{s.sub}</p>
                </motion.div>
              </AnimatePresence>

              {/* Progress dots */}
              <div className="flex gap-3 items-center">
                {STAGES.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      width: i === activeStage ? 28 : 8,
                      background: i <= activeStage ? s.accent : '#e2e8f0',
                    }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="h-2 rounded-full"
                  />
                ))}
              </div>

              {/* Scroll hint */}
              <AnimatePresence>
                {activeStage < CARD_COUNT - 1 && (
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
