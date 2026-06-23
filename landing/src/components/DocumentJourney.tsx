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
    statusColor: '#7c3aed',
  },
];

const N = STAGES.length;
const RADIUS = 320;

function DocCard({ index }: { index: number }) {
  const s = STAGES[index];
  const Icon = s.icon;
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden w-72"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)' }}
    >
      {/* Chrome */}
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-2 text-[9px] text-center text-slate-400">app.qlarity.io</div>
        <div className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: s.light, color: s.accent }}>
          {s.tag.toUpperCase()}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 relative">
        {/* File header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.light }}>
            <FileText size={16} style={{ color: s.accent }} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">Q4_Finance_Report_v2.pdf</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Sarah K. · 2.4 MB</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{ background: s.light, color: s.statusColor }}>
          <Icon size={12} /> {s.statusLabel}
        </div>

        {/* Doc lines */}
        <div className="flex flex-col gap-2">
          {[100, 80, 92, 68, 86].map((w, i) => (
            <div key={i} className="h-2 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
          ))}
        </div>

        {/* Comments for stage 1+ */}
        {index >= 1 && (
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            {[
              { a: 'JR', text: 'Verify Q3 figures please', c: '#f59e0b' },
              { a: 'SK', text: 'Updated — looks good ✓', c: '#10b981' },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                  style={{ background: c.c }}>{c.a}</div>
                <span className="text-xs text-slate-500">{c.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Approved stamp for stage 2+ */}
        {index >= 2 && (
          <div className="absolute top-20 right-4 border-2 border-emerald-500 rounded-lg px-3 py-1.5"
            style={{ background: 'rgba(236,253,245,0.95)', transform: 'rotate(-7deg)' }}>
            <span className="text-[10px] font-black text-emerald-600 tracking-widest uppercase">✓ Approved</span>
          </div>
        )}

        {/* Footer avatars */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex -space-x-2">
            {['SK', 'JR', 'MT'].map((a, i) => (
              <div key={a} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                style={{ background: ['#f59e0b', '#10b981', '#6366f1'][i] }}>{a}</div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock size={10} /> 2m ago
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Map scroll 0→1 to rotateY 0 → -(N-1)*90
  const rawRotY = useTransform(scrollYProgress, [0, 1], [0, -(N - 1) * 90]);
  const carouselRotY = useSpring(rawRotY, { stiffness: 55, damping: 22, mass: 1.2 });

  // Track active stage
  const rawStage = useTransform(scrollYProgress, [0, 1], [0, N - 1]);
  useMotionValueEvent(rawStage, 'change', (v) => {
    setActiveStage(Math.min(N - 1, Math.max(0, Math.round(v))));
  });

  const s = STAGES[activeStage];

  return (
    <section className="relative bg-[#FAFAFA]">
      <div ref={containerRef} className="relative" style={{ height: `${N * 100}vh` }}>
        <div className="sticky top-0 h-screen overflow-hidden flex items-center">

          {/* Shifting bg glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ background: `radial-gradient(ellipse 55% 45% at 40% 50%, ${s.accent}12 0%, transparent 70%)` }}
            transition={{ duration: 0.7 }}
            aria-hidden="true"
          />
          <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

          {/* Full-width container — carousel on left, text overlaps from right */}
          <div className="relative w-full max-w-6xl mx-auto px-6">

            {/* 3D Carousel — left-anchored */}
            <div
              className="absolute left-6"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48%',
                height: 420,
                perspective: 1000,
              }}
            >
              <motion.div
                style={{
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  rotateY: carouselRotY,
                  position: 'relative',
                }}
              >
                {STAGES.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) rotateY(${i * 90}deg) translateZ(${RADIUS}px)`,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    <DocCard index={i} />
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Text — sits on the right with a clear gap from the carousel */}
            <div className="relative ml-auto w-[44%] flex flex-col gap-6 py-8 pl-4">
              {/* Frosted backdrop so text stays readable over carousel */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ background: 'linear-gradient(to left, rgba(250,250,250,0.97) 55%, rgba(250,250,250,0.7) 100%)' }}
              />

              <div className="relative flex flex-col gap-6">
                {/* Stage pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {STAGES.map((st, i) => (
                    <motion.div
                      key={st.tag}
                      animate={{
                        background: i === activeStage ? s.accent : i < activeStage ? `${s.accent}22` : '#f1f5f9',
                        color: i === activeStage ? '#fff' : i < activeStage ? s.accent : '#94a3b8',
                        scale: i === activeStage ? 1.05 : 1,
                      }}
                      transition={{ duration: 0.35 }}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-full"
                    >
                      {String(i + 1).padStart(2, '0')} {st.tag}
                    </motion.div>
                  ))}
                </div>

                {/* Headline */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStage}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <h2 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-3">
                      {s.headline}
                    </h2>
                    <p className="text-xl text-slate-500 leading-relaxed">{s.sub}</p>
                  </motion.div>
                </AnimatePresence>

                {/* Progress dots */}
                <div className="flex gap-2 items-center">
                  {STAGES.map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        width: i === activeStage ? 32 : 8,
                        background: i <= activeStage ? s.accent : '#e2e8f0',
                      }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="h-2 rounded-full"
                    />
                  ))}
                </div>

                {/* Scroll hint */}
                <AnimatePresence>
                  {activeStage < N - 1 && (
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
      </div>
    </section>
  );
}
