import { motion, useScroll, useTransform, useSpring, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import { Upload, GitPullRequest, Globe, CheckCircle2, Clock, MessageSquare, Eye, FileText, Shield } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';

const STEPS = [
  {
    step: '01',
    icon: Upload,
    title: 'Upload & Organize',
    desc: 'Drag and drop any document into Qlarity. Organize by folder, department, or tag. Set metadata like owner, expiry date, and category automatically.',
    accent: '#f59e0b',
    accentLight: '#fef3c7',
    tag: 'Upload',
  },
  {
    step: '02',
    icon: GitPullRequest,
    title: 'Route for Approval',
    desc: 'Assign reviewers and kick off a workflow. Approvers get notified, can comment inline, and sign off — all without leaving Qlarity.',
    accent: '#f59e0b',
    accentLight: '#fef3c7',
    tag: 'Review',
  },
  {
    step: '03',
    icon: Globe,
    title: 'Publish & Control Access',
    desc: 'Approved documents go live instantly. Control who can view, download, or share. Every action is logged for compliance.',
    accent: '#10b981',
    accentLight: '#ecfdf5',
    tag: 'Published',
  },
];

// ── Document card that changes state based on scroll ─────────────────────────

function DocCard({ step }: { step: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden w-72">
      {/* Chrome */}
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-2 bg-slate-200 rounded text-[9px] text-slate-500 px-2 py-0.5 text-center">
          app.qlarity.io
        </div>
      </div>

      {/* Document body */}
      <div className="p-4 flex flex-col gap-3">
        {/* File header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <FileText size={16} className="text-amber-500" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Q4_Finance_Report_v2.pdf</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Uploaded by Sarah K. · 2.4 MB</div>
          </div>
        </div>

        {/* Status badge */}
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="upload"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Upload size={11} className="text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-700">Uploaded · awaiting review</span>
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="review"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Eye size={11} className="text-blue-500" />
              <span className="text-[10px] font-semibold text-blue-700">In Review · step 2 of 3</span>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="published"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={11} className="text-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-700">Published · visible to team</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Document lines */}
        <div className="flex flex-col gap-1.5 pt-1">
          {[100, 85, 92, 70, 88].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
          ))}
        </div>

        {/* Review annotations — only in step 1+ */}
        <AnimatePresence>
          {step >= 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
                {[
                  { avatar: 'JR', comment: 'Please verify Q3 figures', color: '#f59e0b' },
                  { avatar: 'SK', comment: 'Updated — looks good ✓', color: '#10b981' },
                ].map((c, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                    className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0"
                      style={{ background: c.color }}>
                      {c.avatar}
                    </div>
                    <span className="text-[9px] text-slate-500">{c.comment}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Approved stamp — only in step 2 */}
        <AnimatePresence>
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: -8 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="absolute top-24 right-4 border-2 border-emerald-500 rounded-lg px-3 py-1.5 pointer-events-none"
              style={{ transform: 'rotate(-8deg)', background: 'rgba(236,253,245,0.9)' }}
            >
              <div className="text-[10px] font-black text-emerald-600 tracking-widest uppercase flex items-center gap-1">
                <Shield size={9} /> Approved
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reviewer avatars */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div className="flex -space-x-1.5">
            {['SK', 'JR', 'MT'].map((a, i) => (
              <div key={a} className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[7px] font-bold text-white"
                style={{ background: ['#f59e0b', '#10b981', '#6366f1'][i] }}>
                {a}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-slate-400">
            <Clock size={9} /> Updated 2m ago
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Floating satellite elements per step ──────────────────────────────────────

function StepFloaters({ step }: { step: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {step === 0 && (
          <>
            <motion.div key="folder"
              initial={{ opacity: 0, x: -20, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -left-16 top-1/3 bg-white border border-amber-200 rounded-xl px-3 py-2 shadow-md text-[10px] font-semibold text-amber-700 flex items-center gap-1.5">
              <Upload size={11} className="text-amber-500" /> Drag & drop
            </motion.div>
            <motion.div key="version"
              initial={{ opacity: 0, x: 20, y: -10 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -right-16 top-1/4 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-md text-[10px] font-semibold text-slate-600 flex items-center gap-1.5">
              <FileText size={11} className="text-slate-400" /> v1 saved
            </motion.div>
          </>
        )}
        {step === 1 && (
          <>
            <motion.div key="comment"
              initial={{ opacity: 0, x: 20, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -right-16 top-1/3 bg-white border border-blue-200 rounded-xl px-3 py-2 shadow-md text-[10px] font-semibold text-blue-700 flex items-center gap-1.5">
              <MessageSquare size={11} className="text-blue-500" /> 3 comments
            </motion.div>
            <motion.div key="reviewer"
              initial={{ opacity: 0, x: -20, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -left-20 bottom-1/3 bg-white border border-amber-200 rounded-xl px-3 py-2 shadow-md text-[10px] font-semibold text-amber-700 flex items-center gap-1.5">
              <Eye size={11} className="text-amber-500" /> Reviewing…
            </motion.div>
          </>
        )}
        {step === 2 && (
          <>
            <motion.div key="live"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -right-20 top-1/4 bg-emerald-500 rounded-xl px-3 py-2 shadow-lg text-[10px] font-bold text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
            </motion.div>
            <motion.div key="access"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -left-20 top-1/3 bg-white border border-emerald-200 rounded-xl px-3 py-2 shadow-md text-[10px] font-semibold text-emerald-700 flex items-center gap-1.5">
              <Shield size={11} className="text-emerald-500" /> Access set
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Document drifts DOWN as you scroll — directly scrubbed
  const rawDocY    = useTransform(scrollYProgress, [0, 1], [-80, 80]);
  const rawDocRot  = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [-6, -1, 2, 5]);
  const rawDocScale = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0.88, 1, 1, 0.93]);

  const docY     = useSpring(rawDocY,    { stiffness: 55, damping: 22, mass: 1.2 });
  const docRot   = useSpring(rawDocRot,  { stiffness: 55, damping: 22, mass: 1.2 });
  const docScale = useSpring(rawDocScale,{ stiffness: 55, damping: 22, mass: 1.2 });

  // Glow shifts with document
  const glowY = useTransform(scrollYProgress, [0, 1], [-40, 40]);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActiveStep(v < 0.37 ? 0 : v < 0.7 ? 1 : 2);
  });

  const s = STEPS[activeStep];

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-20 bg-[#FAFAFA]">
      <div ref={containerRef} className="relative h-[300vh]">
        <div className="sticky top-0 h-screen overflow-hidden flex items-center">

          {/* Grid */}
          <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

          {/* Ambient glow that follows the document */}
          <motion.div
            aria-hidden="true"
            className="absolute left-1/4 w-96 h-96 rounded-full pointer-events-none -translate-x-1/2"
            style={{
              y: glowY,
              background: `radial-gradient(ellipse, ${activeStep === 2 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.10)'} 0%, transparent 70%)`,
              filter: 'blur(48px)',
              top: '50%',
              translateY: '-50%',
            }}
          />

          <div className="relative max-w-6xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* ── LEFT: scroll-scrubbed document ── */}
            <div className="relative flex items-center justify-center order-2 lg:order-1" style={{ height: 400 }}>
              <motion.div
                style={{ y: docY, rotate: docRot, scale: docScale }}
                className="relative"
              >
                <StepFloaters step={activeStep} />
                <DocCard step={activeStep} />
              </motion.div>
            </div>

            {/* ── RIGHT: step content ── */}
            <div className="order-1 lg:order-2 flex flex-col gap-8">
              <motion.div
                variants={stagger(0.08)}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
              >
                <motion.div variants={blurUp}
                  className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 mb-4">
                  Simple workflow
                </motion.div>
                <motion.h2
                  id="how-it-works-heading"
                  variants={blurUp}
                  className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight mb-2"
                >
                  From upload to published
                  <br />
                  <span className="text-gradient">in three steps.</span>
                </motion.h2>
              </motion.div>

              {/* Step list */}
              <div className="relative flex flex-col">
                {/* Track line */}
                <div aria-hidden="true" className="absolute left-[9px] top-3 bottom-3 w-px bg-slate-100" />
                <motion.div
                  aria-hidden="true"
                  className="absolute left-[9px] top-3 w-px origin-top rounded-full"
                  animate={{
                    height: activeStep === 0 ? '12%' : activeStep === 1 ? '55%' : '92%',
                    background: s.accent,
                  }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                />

                {STEPS.map((step, i) => {
                  const active = activeStep === i;
                  const done   = activeStep > i;
                  const Icon   = step.icon;
                  return (
                    <motion.div
                      key={step.step}
                      animate={{ opacity: active ? 1 : done ? 0.5 : 0.3 }}
                      transition={{ duration: 0.4 }}
                      className="relative pl-8 py-5"
                    >
                      {/* Dot */}
                      <motion.div
                        className="absolute left-0 top-[22px] w-[19px] h-[19px] rounded-full border-2 border-white shadow flex items-center justify-center"
                        animate={{ background: active ? step.accent : done ? '#10b981' : '#e2e8f0', scale: active ? 1.2 : 1 }}
                        transition={{ duration: 0.35 }}
                      >
                        {done
                          ? <CheckCircle2 size={10} className="text-white" />
                          : active && <motion.div className="w-2 h-2 rounded-full bg-white" initial={{ scale: 0 }} animate={{ scale: 1 }} />
                        }
                      </motion.div>

                      <div className="pl-4">
                        <div className="flex items-center gap-2 mb-1">
                          <motion.span
                            className="text-[10px] font-mono font-bold"
                            animate={{ color: active ? step.accent : '#94a3b8' }}
                          >
                            {step.step}
                          </motion.span>
                          {active && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: s.accentLight, color: s.accent }}
                            >
                              {step.tag}
                            </motion.span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon size={14} style={{ color: active ? step.accent : '#94a3b8' }} />
                          <h3 className="text-sm font-bold text-slate-800">{step.title}</h3>
                        </div>
                        <motion.p
                          className="text-sm text-slate-500 leading-relaxed max-w-sm"
                          animate={{ opacity: active ? 1 : 0.5 }}
                        >
                          {step.desc}
                        </motion.p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Scroll hint */}
              <motion.div
                animate={{ opacity: activeStep < 2 ? 1 : 0 }}
                className="flex items-center gap-2 text-xs text-slate-400 pl-8"
              >
                <motion.div
                  animate={{ y: [0, 5, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-4 h-6 rounded-full border border-slate-200 flex items-start justify-center pt-1"
                >
                  <div className="w-0.5 h-1.5 bg-amber-400 rounded-full" />
                </motion.div>
                Scroll to continue
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
