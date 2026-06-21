import { motion, useMotionValue, useSpring, useMotionTemplate, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles, Upload, Eye, CheckCircle, Globe, FileText, Clock, Bell, Users } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

// ── Workflow stages ───────────────────────────────────────────────────────────
const STAGES = [
  {
    id: 'upload',
    icon: Upload,
    label: 'Upload',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.3)',
    desc: 'Drag & drop any file',
    activity: 'Legal_NDA_Template_v3.pdf uploaded by Priya M.',
  },
  {
    id: 'review',
    icon: Eye,
    label: 'Review',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    desc: 'Team reviews & comments',
    activity: 'Sarah K. left 3 comments',
  },
  {
    id: 'approve',
    icon: CheckCircle,
    label: 'Approve',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.3)',
    desc: 'Sign-off from stakeholders',
    activity: 'James R. approved · 2 of 2 done',
  },
  {
    id: 'publish',
    icon: Globe,
    label: 'Publish',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.3)',
    desc: 'Live for your whole team',
    activity: 'Published to company portal',
  },
];

// Simulated document progressing through the pipeline
const DOCS = [
  { name: 'Q4_Finance_Report_v2.pdf',    type: 'PDF',  avatar: 'SK' },
  { name: 'Employee_Handbook_2025.docx', type: 'DOCX', avatar: 'MT' },
  { name: 'Legal_NDA_Template_v3.pdf',   type: 'PDF',  avatar: 'PM' },
  { name: 'Sales_Contract_Acme.docx',    type: 'DOCX', avatar: 'JR' },
];

const STEP_DURATION = 2200; // ms each stage holds
const TOTAL_STAGES  = STAGES.length;

function ConnectorLine({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div className="flex-1 relative flex items-center mx-1" style={{ minWidth: 24 }}>
      <div className="w-full h-px bg-slate-200 absolute" />
      <motion.div
        className="h-px absolute left-0"
        style={{ background: 'linear-gradient(90deg, #f59e0b, #10b981)' }}
        initial={{ width: '0%' }}
        animate={{ width: done ? '100%' : active ? '50%' : '0%' }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      />
      {/* traveling dot */}
      {active && (
        <motion.div
          className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(245,158,11,0.6)]"
          initial={{ left: '0%' }}
          animate={{ left: '50%' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          style={{ top: '50%', transform: 'translate(-50%,-50%)' }}
        />
      )}
    </div>
  );
}

function StageNode({ stage, state, index }: {
  stage: typeof STAGES[number];
  state: 'idle' | 'active' | 'done';
  index: number;
}) {
  const Icon = stage.icon;
  const isActive = state === 'active';
  const isDone   = state === 'done';

  return (
    <motion.div
      className="flex flex-col items-center gap-2 relative"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Icon circle */}
      <motion.div
        className="relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all"
        animate={{
          background: isActive ? stage.bg : isDone ? stage.bg : 'rgba(248,250,252,1)',
          borderColor: isActive || isDone ? stage.border : 'rgba(226,232,240,1)',
          scale: isActive ? 1.12 : 1,
        }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <Icon size={18} style={{ color: isActive || isDone ? stage.color : '#94a3b8' }} />
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: stage.color }}
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        {isDone && (
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <CheckCircle2 size={9} className="text-white" />
          </motion.div>
        )}
      </motion.div>

      {/* Label */}
      <div className="text-center">
        <div className={`text-xs font-semibold transition-colors ${isActive ? '' : isDone ? 'text-slate-500' : 'text-slate-400'}`}
          style={{ color: isActive ? stage.color : undefined }}>
          {stage.label}
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5 whitespace-nowrap">{stage.desc}</div>
      </div>
    </motion.div>
  );
}

function WorkflowMockup() {
  const [activeStage, setActiveStage]   = useState(0);
  const [docIndex, setDocIndex]         = useState(0);
  const [activityLog, setActivityLog]   = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const advance = () => {
      setActiveStage(prev => {
        const next = (prev + 1) % TOTAL_STAGES;
        // When completing the last stage, advance the doc and reset
        if (next === 0) {
          setDocIndex(d => (d + 1) % DOCS.length);
          setActivityLog([]);
        } else {
          setActivityLog(log => [...log.slice(-3), STAGES[prev].activity]);
        }
        return next;
      });
      timerRef.current = setTimeout(advance, STEP_DURATION);
    };
    timerRef.current = setTimeout(advance, STEP_DURATION);
    return () => clearTimeout(timerRef.current);
  }, []);

  const doc = DOCS[docIndex];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden w-full max-w-2xl mx-auto">
      {/* Chrome bar */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 text-center text-[10px] text-slate-400 font-medium">app.qlarity.io / workflow</div>
        <Bell size={11} className="text-slate-500" />
      </div>

      <div className="p-6 flex flex-col gap-5">
        {/* Active document card */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <FileText size={16} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={doc.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-xs font-semibold text-slate-800 truncate">{doc.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                  <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">{doc.type}</span>
                  <span>Uploaded by {doc.avatar}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: STAGES[activeStage].bg, color: STAGES[activeStage].color, border: `1px solid ${STAGES[activeStage].border}` }}>
            {STAGES[activeStage].label}
          </div>
        </div>

        {/* Workflow pipeline */}
        <div className="flex items-start gap-0">
          {STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-center flex-1 min-w-0">
              <StageNode
                stage={stage}
                state={i < activeStage ? 'done' : i === activeStage ? 'active' : 'idle'}
                index={i}
              />
              {i < STAGES.length - 1 && (
                <ConnectorLine
                  active={i === activeStage}
                  done={i < activeStage}
                />
              )}
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-2" style={{ minHeight: 72 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={10} className="text-slate-400" />
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Recent activity</span>
          </div>
          <AnimatePresence initial={false}>
            {activityLog.map((entry, i) => (
              <motion.div
                key={`${entry}-${i}`}
                initial={{ opacity: 0, x: -8, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-[10px] text-slate-500">{entry}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {activityLog.length === 0 && (
            <div className="text-[10px] text-slate-300 italic">Waiting for activity…</div>
          )}
        </div>

        {/* Participants */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            <Users size={10} className="text-slate-400" />
            <span className="text-[10px] text-slate-400">Reviewers</span>
            <div className="flex -space-x-1.5 ml-1">
              {['SK','MT','PM','JR'].map(a => (
                <div key={a} className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-white flex items-center justify-center">
                  <span className="text-[7px] font-bold text-white">{a}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
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
    <section className="relative overflow-hidden min-h-screen flex items-center bg-[#FAFAFA]">
      <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      {/* Cursor spotlight */}
      <div ref={spotlightRef} className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <motion.div className="absolute inset-0" style={{ background: spotlightBg }} />
      </div>

      {/* Ambient glow */}
      <div aria-hidden="true" className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative w-full max-w-5xl mx-auto px-6 py-32 pt-36 flex flex-col items-center gap-10 text-center">
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
            <span className="text-slate-900">Your documents,</span>
            <br />
            <span className="text-gradient">always moving forward.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="max-w-xl text-lg sm:text-xl text-slate-500 leading-relaxed">
            Qlarity gives every document a clear path — from upload to approval to publish — so nothing stalls in someone's inbox.
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

          {/* Workflow mockup */}
          <motion.div
            variants={fadeUp}
            className="w-full mt-2"
            style={{ perspective: 1000 }}
          >
            <motion.div
              initial={{ rotateX: 6, opacity: 0, y: 20 }}
              animate={{ rotateX: 0, opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <WorkflowMockup />
            </motion.div>
          </motion.div>
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
