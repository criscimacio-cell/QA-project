import { motion, useScroll, useTransform, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

const FILES = [
  { name: 'Q4_Finance_Report_v2.pdf', status: 'approved', statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Employee_Handbook_2025.docx', status: 'in review', statusColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: 'Product_Roadmap_Draft.pptx', status: 'draft', statusColor: 'bg-slate-100 text-slate-500 border-slate-200' },
  { name: 'Legal_NDA_Template.pdf', status: 'published', statusColor: 'bg-blue-50 text-blue-700 border-blue-200' },
];

const NAV = ['Dashboard', 'Documents', 'Shared with Me', 'Templates', 'Archive'];

function LaptopMockup({ scrollYProgress }: { scrollYProgress: ReturnType<typeof useScroll>['scrollYProgress'] }) {
  // Scroll drives the viewing angle — starts dramatic side-perspective, settles front-facing
  const rotateX = useTransform(scrollYProgress, [0, 0.6], [14, 3]);
  const rotateY = useTransform(scrollYProgress, [0, 0.6], [-22, -5]);
  const scale   = useTransform(scrollYProgress, [0, 0.5], [0.82, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.18], [0, 1]);

  const rX = useSpring(rotateX, { stiffness: 60, damping: 20 });
  const rY = useSpring(rotateY, { stiffness: 60, damping: 20 });
  const sc = useSpring(scale,   { stiffness: 60, damping: 20 });

  return (
    <motion.div
      style={{ rotateX: rX, rotateY: rY, scale: sc, opacity, transformPerspective: 1600 }}
      className="w-full max-w-3xl mx-auto select-none"
      aria-hidden="true"
    >
      {/* ── Screen lid ─────────────────────────────────────── */}
      <div className="relative rounded-t-[18px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.22)]"
        style={{ background: 'linear-gradient(160deg, #c8cacf 0%, #a0a4ab 40%, #8a8e95 100%)' }}>

        {/* Top camera dot */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-600/50 z-10" />

        {/* Screen bezel inset */}
        <div className="mx-3 mt-5 mb-2 rounded-xl overflow-hidden bg-white shadow-inner ring-1 ring-black/10">
          {/* App chrome bar */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-100">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <div className="flex-1 mx-4 h-5 bg-white border border-slate-200 rounded-md flex items-center px-2 gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <div className="text-[9px] text-slate-400 font-medium">app.qlarity.io</div>
            </div>
          </div>

          {/* App layout */}
          <div className="flex" style={{ height: '320px' }}>
            {/* Sidebar */}
            <div className="w-40 flex-shrink-0 bg-slate-50 border-r border-slate-100 flex flex-col gap-0.5 p-2">
              <div className="px-2 py-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-[2px] bg-white" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-800">Qlarity</span>
                </div>
              </div>
              {NAV.map((item, i) => (
                <div key={item} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] font-medium ${i === 1 ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 1 ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  {item}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                <div>
                  <div className="text-[10px] font-semibold text-slate-800">Documents</div>
                  <div className="text-[8px] text-slate-400 mt-0.5">4 files · updated recently</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-5 px-2 bg-slate-100 rounded text-[8px] text-slate-500 flex items-center">Filter</div>
                  <div className="h-5 px-2 bg-amber-500 rounded text-[8px] text-white font-medium flex items-center">+ Upload</div>
                </div>
              </div>

              {/* File rows */}
              <div className="flex-1 overflow-hidden p-2 flex flex-col gap-1.5">
                {FILES.map((f, i) => (
                  <motion.div
                    key={f.name}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-2.5 bg-white hover:bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 hover:border-slate-200 cursor-default"
                  >
                    <div className="w-6 h-6 rounded-md bg-amber-50 border border-amber-200 flex-shrink-0 flex items-center justify-center">
                      <div className="w-2.5 h-3 rounded-[2px] border border-amber-300 bg-amber-100" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-slate-700 truncate font-medium">{f.name}</div>
                      <div className="text-[8px] text-slate-400 mt-0.5">Updated 3h ago</div>
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${f.statusColor}`}>
                      {f.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hinge bar ───────────────────────────────────────── */}
      <div className="h-[6px] mx-0 rounded-none shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        style={{ background: 'linear-gradient(to bottom, #9ca3af, #6b7280)' }} />

      {/* ── Base / keyboard ─────────────────────────────────── */}
      <div className="relative rounded-b-[14px] pt-3 pb-4 px-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        style={{ background: 'linear-gradient(170deg, #d1d5db 0%, #b8bcc4 50%, #c8cace 100%)' }}>

        {/* Keyboard grid */}
        <div className="grid gap-y-1 mb-3" style={{ gridTemplateColumns: 'repeat(13, 1fr)', gap: '2px' }}>
          {Array.from({ length: 52 }).map((_, i) => (
            <div key={i} className="h-3 rounded-[2px] bg-white/40 shadow-inner" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)' }} />
          ))}
          {/* Space bar */}
          <div className="col-span-5 col-start-4 h-3 rounded-[2px] bg-white/40 shadow-inner" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)', gridColumn: '4 / span 7' }} />
        </div>

        {/* Trackpad */}
        <div className="mx-auto w-24 h-10 rounded-lg bg-white/20 border border-white/30 shadow-inner" />
      </div>

      {/* ── Table reflection ────────────────────────────────── */}
      <div className="h-8 rounded-b-xl mx-1 opacity-20"
        style={{ background: 'linear-gradient(to bottom, rgba(100,116,139,0.4), transparent)' }} />
    </motion.div>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const blobY  = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const textY  = useTransform(scrollYProgress, [0, 0.3], [0, 28]);
  const fadeOut = useTransform(scrollYProgress, [0, 0.22], [1, 0]);

  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 18 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 18 });
  const spotlightBg = useMotionTemplate`radial-gradient(480px circle at ${smoothX}% ${smoothY}%, rgba(245,158,11,0.055), transparent 65%)`;

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

  // Scroll progress for laptop tilt (starts after text section)
  const laptopRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: laptopScroll } = useScroll({
    target: laptopRef,
    offset: ['start 0.9', 'center 0.4'],
  });

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FAFAFA]/20 to-[#FAFAFA] pointer-events-none" aria-hidden="true" />

      <motion.div style={{ y: blobY }} aria-hidden="true"
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
        <div style={{ width: '100%', height: '100%', background: 'radial-gradient(ellipse, rgba(245,158,11,0.11) 0%, rgba(252,211,77,0.06) 45%, transparent 70%)', filter: 'blur(50px)' }} />
      </motion.div>
      <motion.div style={{ y: blobY2 }} aria-hidden="true"
        className="absolute top-32 right-[15%] w-[350px] h-[350px] rounded-full pointer-events-none"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, delay: 0.2 }}>
        <div style={{ width: '100%', height: '100%', background: 'radial-gradient(circle, rgba(251,191,36,0.09) 0%, transparent 70%)', filter: 'blur(55px)' }} />
      </motion.div>

      <div ref={spotlightRef} className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <motion.div className="absolute inset-0" style={{ background: spotlightBg }} />
      </div>

      {/* ── Above-fold: headline + CTAs ── */}
      <motion.div
        style={{ y: textY, opacity: fadeOut }}
        className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-6"
      >
        <motion.div variants={stagger(0.09)} initial="hidden" animate="show" className="flex flex-col items-center gap-6 text-center max-w-4xl mx-auto">
          <motion.div variants={blurUp} className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
              <Sparkles size={11} />
              Now in early access
            </span>
            {BADGES.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-500 shadow-sm">
                <CheckCircle2 size={11} className="text-amber-500" />
                {b}
              </span>
            ))}
          </motion.div>

          <motion.h1
            variants={blurUp}
            aria-label="One place for all your documents."
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.12]"
          >
            <span className="text-slate-900">One place for all</span>
            <br />
            <span className="text-gradient">your documents.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="max-w-2xl text-lg sm:text-xl text-slate-500 leading-relaxed">
            Qlarity is a modern document management system — store, version, review, and publish
            files across your organization with approval workflows and audit trails built in.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3 justify-center">
            <MagneticButton href="/register"
              className="shimmer-btn inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors glow-amber-sm focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              Start for Free <ArrowRight size={16} />
            </MagneticButton>
            <MagneticButton href="#how-it-works" strength={0.22}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium px-8 py-3.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              <Play size={14} className="fill-current text-amber-500" />
              See How It Works
            </MagneticButton>
          </motion.div>

          <motion.div variants={fadeUp}>
            <p className="text-xs text-slate-500">No credit card required · Free to get started</p>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div aria-hidden="true"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
          <span className="text-xs text-slate-400">Scroll to explore</span>
          <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border border-slate-300 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-amber-500/60 rounded-full" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── Laptop mockup — scroll-driven perspective ── */}
      <div ref={laptopRef} className="relative pb-24 px-6">
        <LaptopMockup scrollYProgress={laptopScroll} />
      </div>
    </section>
  );
}
