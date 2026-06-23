import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import { Upload, GitPullRequest, Globe, CheckCircle2, Clock } from 'lucide-react';

const STEPS = [
  {
    step: '01', icon: Upload, title: 'Upload & Organize',
    desc: 'Drag and drop any document into Qlarity. Organize by folder, department, or tag. Set metadata like owner, expiry date, and category automatically.',
    color: 'text-amber-600', accent: '#F59E0B', accentLight: '#FEF3C7', accentBorder: '#FDE68A',
    dotColor: '#F59E0B', lineColor: 'rgba(245,158,11,0.5)',
    bgGlow: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(245,158,11,0.08) 0%, transparent 70%)',
  },
  {
    step: '02', icon: GitPullRequest, title: 'Route for Approval',
    desc: 'Assign reviewers and kick off a workflow. Approvers get notified, can comment inline, and sign off — all without leaving Qlarity.',
    color: 'text-blue-600', accent: '#3B82F6', accentLight: '#EFF6FF', accentBorder: '#BFDBFE',
    dotColor: '#3B82F6', lineColor: 'rgba(59,130,246,0.5)',
    bgGlow: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(59,130,246,0.08) 0%, transparent 70%)',
  },
  {
    step: '03', icon: Globe, title: 'Publish & Control Access',
    desc: 'Approved documents go live instantly. Control who can view, download, or share. Every action is logged for compliance.',
    color: 'text-emerald-600', accent: '#10B981', accentLight: '#ECFDF5', accentBorder: '#A7F3D0',
    dotColor: '#10B981', lineColor: 'rgba(16,185,129,0.5)',
    bgGlow: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(16,185,129,0.08) 0%, transparent 70%)',
  },
];

// ─── Step product preview panels ──────────────────────────────────────────────

function UploadPreview() {
  return (
    <div className="flex flex-col gap-3 p-5">
      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, transform: 'scale(0.97)' }}
        animate={{ opacity: 1, transform: 'scale(1)' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-center"
      >
        <Upload size={22} className="mx-auto mb-2 text-amber-400" />
        <p className="text-xs font-medium text-amber-700">Drop files here to upload</p>
        <p className="text-xs text-amber-500 mt-0.5">PDF, DOCX, PPTX and more</p>
      </motion.div>

      {/* File list */}
      {[
        { name: 'Q4_Finance_Report.pdf', progress: null, done: true },
        { name: 'Employee_Handbook.docx', progress: 72, done: false },
        { name: 'Legal_NDA_Template.pdf', progress: null, done: false, waiting: true },
      ].map((f, i) => (
        <motion.div
          key={f.name}
          initial={{ opacity: 0, transform: 'translateX(-12px)' }}
          animate={{ opacity: 1, transform: 'translateX(0px)' }}
          transition={{ delay: 0.1 + i * 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-slate-100 shadow-sm"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-700 truncate">{f.name}</div>
            {f.progress != null && (
              <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${f.progress}%` }}
                  transition={{ duration: 1.2, ease: 'linear', delay: 0.4 }}
                  className="h-full bg-amber-400 rounded-full"
                />
              </div>
            )}
          </div>
          {f.done && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
          {f.waiting && <Clock size={14} className="text-slate-300 flex-shrink-0" />}
          {f.progress != null && <span className="text-xs text-amber-600 font-medium flex-shrink-0">{f.progress}%</span>}
        </motion.div>
      ))}
    </div>
  );
}

function ApprovalPreview() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <motion.div
        initial={{ opacity: 0, transform: 'translateY(-6px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5"
      >
        <div className="text-xs font-semibold text-blue-700 mb-0.5">Approval in progress</div>
        <div className="text-xs text-blue-500">NDA_Template.pdf · Step 2 of 3</div>
      </motion.div>

      <div className="relative pl-4">
        {/* Connecting line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200" />
        <motion.div
          className="absolute left-[11px] top-3 w-px bg-blue-400 origin-top"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '45%' }}
        />

        {[
          { initials: 'JD', name: 'John D.', role: 'Author', status: 'approved', color: '#10B981', bgColor: '#ECFDF5', textColor: '#065F46' },
          { initials: 'SM', name: 'Sarah M.', role: 'Legal Review', status: 'reviewing', color: '#3B82F6', bgColor: '#EFF6FF', textColor: '#1E40AF', pulse: true },
          { initials: 'CE', name: 'CEO', role: 'Final Approval', status: 'waiting', color: '#94A3B8', bgColor: '#F8FAFC', textColor: '#64748B' },
        ].map((node, i) => (
          <motion.div
            key={node.name}
            initial={{ opacity: 0, transform: 'translateX(10px)' }}
            animate={{ opacity: 1, transform: 'translateX(0px)' }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 mb-4 relative"
          >
            {/* Timeline dot */}
            <div className="relative flex-shrink-0">
              <div
                style={{ background: node.color }}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold z-10 relative`}
              >
                {node.initials}
              </div>
              {node.pulse && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: node.color }}
                  animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800">{node.name}</div>
              <div className="text-xs text-slate-400">{node.role}</div>
            </div>
            <span
              style={{ background: node.bgColor, color: node.textColor, border: `1px solid ${node.color}30` }}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
            >
              {node.status === 'approved' ? '✓ Approved' : node.status === 'reviewing' ? '◉ Reviewing' : '○ Waiting'}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PublishPreview() {
  return (
    <div className="flex flex-col gap-3 p-5">
      <motion.div
        initial={{ opacity: 0, transform: 'scale(0.95)' }}
        animate={{ opacity: 1, transform: 'scale(1)' }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3"
      >
        <motion.div
          initial={{ transform: 'scale(0)' }}
          animate={{ transform: 'scale(1)' }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <CheckCircle2 size={18} className="text-emerald-500" />
        </motion.div>
        <div>
          <div className="text-xs font-bold text-emerald-700">Published</div>
          <div className="text-xs text-emerald-500">NDA_Template.pdf · visible to team</div>
        </div>
      </motion.div>

      <div className="text-xs font-semibold text-slate-500 px-1">Access Control</div>

      {[
        { icon: '👔', role: 'Executives', access: 'View & Download', allowed: true, delay: 0.1 },
        { icon: '⚖️', role: 'Legal Team', access: 'Edit & Approve', allowed: true, delay: 0.18 },
        { icon: '👥', role: 'All Staff', access: 'View only', allowed: true, delay: 0.26 },
        { icon: '🔒', role: 'External', access: 'No access', allowed: false, delay: 0.34 },
      ].map((row) => (
        <motion.div
          key={row.role}
          initial={{ opacity: 0, transform: 'translateX(-10px)' }}
          animate={{ opacity: 1, transform: 'translateX(0px)' }}
          transition={{ delay: row.delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-slate-100"
        >
          <span className="text-sm">{row.icon}</span>
          <span className="text-xs text-slate-700 flex-1">{row.role}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            row.allowed
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-slate-100 text-slate-400'
          }`}>{row.access}</span>
        </motion.div>
      ))}
    </div>
  );
}

const PREVIEWS = [UploadPreview, ApprovalPreview, PublishPreview];

// ─── Main component ────────────────────────────────────────────────────────────

export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const [activeStep, setActiveStep] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = v < 0.37 ? 0 : v < 0.72 ? 1 : 2;
    setActiveStep(next);
  });

  const s = STEPS[activeStep];
  const Preview = PREVIEWS[activeStep];

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-20">
      <div ref={containerRef} className="relative h-[270vh]">
        <div className="sticky top-0 h-screen overflow-hidden flex items-center">

          {/* Ambient background glow that shifts per step */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ background: s.bgGlow }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />
          <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-30" />

          <div className="relative max-w-6xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">

            {/* ── Left: product preview window ── */}
            <div className="relative order-2 lg:order-1">
              {/* Outer glow ring behind the window */}
              <motion.div
                className="absolute -inset-4 rounded-3xl pointer-events-none blur-2xl opacity-30"
                animate={{ background: `radial-gradient(ellipse, ${s.accent}40 0%, transparent 70%)` }}
                transition={{ duration: 0.7 }}
                aria-hidden="true"
              />

              {/* The window card */}
              <motion.div
                className="relative rounded-2xl border border-slate-200 bg-white shadow-xl shadow-black/5 overflow-hidden"
                animate={{ borderColor: `${s.accentBorder}` }}
                transition={{ duration: 0.5 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Window chrome */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <div className="flex-1 mx-3">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeStep}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="h-4 rounded-md text-[10px] flex items-center px-2"
                        style={{ background: s.accentLight, color: s.accent }}
                      >
                        app.qlarity.io / {activeStep === 0 ? 'upload' : activeStep === 1 ? 'review' : 'published'}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <motion.div
                    className="text-[9px] font-bold px-2 py-0.5 rounded"
                    animate={{ background: s.accentLight, color: s.accent }}
                    transition={{ duration: 0.4 }}
                  >
                    LIVE
                  </motion.div>
                </div>

                {/* Animated content area */}
                <div className="min-h-[280px] relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, transform: 'translateY(16px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0, transform: 'translateY(-12px)' }}
                      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0"
                    >
                      <Preview />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Step counter badge */}
              <motion.div
                className="absolute -bottom-4 -right-4 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center text-white font-black text-lg"
                animate={{ background: s.accent }}
                transition={{ duration: 0.5 }}
              >
                {activeStep + 1}
              </motion.div>
            </div>

            {/* ── Right: step list ── */}
            <div className="order-1 lg:order-2">
              <motion.div
                initial={{ opacity: 0, transform: 'translateY(24px)' }}
                whileInView={{ opacity: 1, transform: 'translateY(0px)' }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="mb-10"
              >
                <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-xs font-medium text-blue-600 mb-4">
                  Simple workflow
                </div>
                <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                  From upload to published
                  <br />
                  <span className="text-gradient">in three steps.</span>
                </h2>
              </motion.div>

              {/* Step items */}
              <div className="relative">
                {/* Vertical progress line */}
                <div aria-hidden="true" className="absolute left-[9px] top-3 bottom-3 w-px bg-slate-200" />
                <motion.div
                  aria-hidden="true"
                  className="absolute left-[9px] top-3 w-px origin-top"
                  animate={{
                    height: activeStep === 0 ? '10%' : activeStep === 1 ? '55%' : '90%',
                    background: s.accent,
                  }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />

                <div className="flex flex-col gap-0">
                  {STEPS.map((step, i) => {
                    const active = activeStep === i;
                    return (
                      <motion.div
                        key={step.step}
                        animate={{
                          opacity: active ? 1 : 0.38,
                        }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="relative pl-8 py-5"
                      >
                        {/* Timeline dot */}
                        <motion.div
                          className="absolute left-0 top-[22px] w-[19px] h-[19px] rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                          animate={{
                            background: active ? step.accent : '#E2E8F0',
                            scale: active ? 1.15 : 0.85,
                          }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {active && (
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full bg-white"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                        </motion.div>

                        {/* Left accent border */}
                        <motion.div
                          className="absolute left-5 top-2 bottom-2 w-[2px] rounded-full"
                          animate={{ background: active ? step.accent : 'transparent', opacity: active ? 1 : 0 }}
                          transition={{ duration: 0.35 }}
                          aria-hidden="true"
                        />

                        <div className="pl-4">
                          <motion.span
                            className="text-xs font-mono font-bold block mb-1"
                            animate={{ color: active ? step.accent : '#94A3B8' }}
                            transition={{ duration: 0.35 }}
                          >
                            {step.step}
                          </motion.span>
                          <h3 className="text-base font-bold text-slate-900 mb-1">{step.title}</h3>
                          <motion.p
                            className="text-sm text-slate-500 leading-relaxed max-w-sm"
                            animate={{ opacity: active ? 1 : 0.6 }}
                            transition={{ duration: 0.35 }}
                          >
                            {step.desc}
                          </motion.p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
