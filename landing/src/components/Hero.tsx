import { motion, useScroll, useTransform, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

const FILES = [
  { name: 'Q4_Finance_Report_v2.pdf',    status: 'approved',  sc: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { name: 'Employee_Handbook_2025.docx', status: 'in review', sc: 'text-amber-700 bg-amber-50 border-amber-200' },
  { name: 'Product_Roadmap_Draft.pptx',  status: 'draft',     sc: 'text-slate-500 bg-slate-100 border-slate-200' },
  { name: 'Legal_NDA_Template.pdf',      status: 'published', sc: 'text-blue-700 bg-blue-50 border-blue-200' },
];

const NAV = ['Dashboard', 'Documents', 'Shared with Me', 'Templates', 'Archive'];

// ─────────────────────────────────────────────────────────────────
// Laptop mockup — flat construction, perspective tilt via outer transform.
// Starts at a pronounced side angle, rotates toward viewer on scroll.
// ─────────────────────────────────────────────────────────────────
function LaptopMockup({ scrollYProgress }: { scrollYProgress: ReturnType<typeof useScroll>['scrollYProgress'] }) {
  const rawRotY  = useTransform(scrollYProgress, [0, 1], [38, 6]);
  const rawRotX  = useTransform(scrollYProgress, [0, 1], [6, 1]);
  const rawScale = useTransform(scrollYProgress, [0, 0.5], [0.86, 1]);
  const opacity  = useTransform(scrollYProgress, [0, 0.25], [0, 1]);

  const rotateY = useSpring(rawRotY,  { stiffness: 60, damping: 22 });
  const rotateX = useSpring(rawRotX,  { stiffness: 60, damping: 22 });
  const scale   = useSpring(rawScale, { stiffness: 60, damping: 22 });

  return (
    <motion.div
      style={{ opacity, scale, rotateY, rotateX, transformPerspective: 1400 }}
      className="w-full max-w-4xl mx-auto select-none"
      aria-hidden="true"
    >
      {/* ── Screen lid ─────────────────────────────────────────── */}
      <div className="relative rounded-t-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, #d4d7dc 0%, #a8adb5 50%, #8e9299 100%)',
          padding: '10px 10px 6px',
          boxShadow: '0 -2px 0 rgba(255,255,255,0.5) inset, 0 24px 60px rgba(0,0,0,0.22)',
        }}>

        {/* Camera notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full z-10"
          style={{ background: '#3a3d42', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }} />

        {/* Screen glass — dark bezel */}
        <div className="rounded-xl overflow-hidden"
          style={{ background: '#111', padding: '2px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
          <div className="bg-white rounded-[10px] overflow-hidden" style={{ height: 360 }}>

            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100"
              style={{ background: '#f8fafc' }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <div className="flex-1 mx-3 h-5 bg-white border border-slate-200 rounded flex items-center px-2 gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-[9px] text-slate-400 font-medium" style={{ fontFamily: 'system-ui' }}>
                  app.qlarity.io/documents
                </span>
              </div>
            </div>

            {/* App layout */}
            <div className="flex h-full">
              {/* Sidebar */}
              <div className="flex-shrink-0 border-r border-slate-100 flex flex-col gap-0.5"
                style={{ width: 148, background: '#f8fafc', padding: 8 }}>
                <div className="flex items-center gap-1.5 px-2 py-1 mb-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ background: '#f59e0b' }}>
                    <div className="w-2.5 h-2.5 rounded-sm bg-white" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-800" style={{ fontFamily: 'system-ui' }}>Qlarity</span>
                </div>
                {NAV.map((item, i) => (
                  <div key={item} className="flex items-center gap-2 px-2 rounded-lg"
                    style={{
                      padding: '5px 8px',
                      background: i === 1 ? '#fef3c7' : 'transparent',
                      fontSize: 9,
                      fontWeight: i === 1 ? 600 : 400,
                      color: i === 1 ? '#92400e' : '#64748b',
                      fontFamily: 'system-ui',
                    }}>
                    <div className="rounded-full flex-shrink-0"
                      style={{ width: 5, height: 5, background: i === 1 ? '#f59e0b' : '#cbd5e1' }} />
                    {item}
                  </div>
                ))}
              </div>

              {/* Main panel */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Topbar */}
                <div className="flex items-center justify-between border-b border-slate-100"
                  style={{ padding: '8px 14px', background: '#fff' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#1e293b', fontFamily: 'system-ui' }}>Documents</div>
                    <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 1, fontFamily: 'system-ui' }}>4 files · updated recently</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div style={{ height: 18, padding: '0 7px', background: '#f1f5f9', borderRadius: 4, fontSize: 8, color: '#64748b', display: 'flex', alignItems: 'center', fontFamily: 'system-ui' }}>Filter</div>
                    <div style={{ height: 18, padding: '0 7px', background: '#f59e0b', borderRadius: 4, fontSize: 8, color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', fontFamily: 'system-ui' }}>+ Upload</div>
                  </div>
                </div>

                {/* Table header */}
                <div className="flex items-center border-b border-slate-100 px-3"
                  style={{ padding: '4px 14px', background: '#fafafa' }}>
                  <div style={{ flex: 1, fontSize: 7, color: '#94a3b8', fontWeight: 600, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</div>
                  <div style={{ width: 80, fontSize: 7, color: '#94a3b8', fontWeight: 600, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modified</div>
                  <div style={{ width: 70, fontSize: 7, color: '#94a3b8', fontWeight: 600, fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                </div>

                {/* File rows */}
                <div style={{ flex: 1, overflowY: 'hidden', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {FILES.map((f, i) => (
                    <motion.div key={f.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center gap-2.5 rounded-lg cursor-default"
                      style={{ padding: '6px 10px', background: 'white', border: '1px solid #f1f5f9' }}>
                      {/* File icon */}
                      <div className="flex-shrink-0 rounded flex items-center justify-center"
                        style={{ width: 24, height: 28, background: '#fef3c7', border: '1px solid #fde68a' }}>
                        <div style={{ width: 12, height: 14, borderRadius: 1, border: '1.5px solid #f59e0b', background: '#fffbeb' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, color: '#334155', fontWeight: 500, fontFamily: 'system-ui', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      </div>
                      <div style={{ width: 80, fontSize: 8, color: '#94a3b8', fontFamily: 'system-ui', flexShrink: 0 }}>3h ago</div>
                      <div className={`${f.sc} border`}
                        style={{ width: 70, fontSize: 7, padding: '2px 6px', borderRadius: 20, fontFamily: 'system-ui', fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
                        {f.status}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hinge ────────────────────────────────────────────────── */}
      <div style={{
        height: 5,
        background: 'linear-gradient(to bottom, #6b7280, #9ca3af)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      }} />

      {/* ── Keyboard base ────────────────────────────────────────── */}
      <div className="relative rounded-b-2xl"
        style={{
          background: 'linear-gradient(175deg, #c8cdd5 0%, #b0b6bf 40%, #c4c8ce 100%)',
          padding: '10px 16px 16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.20), 0 2px 0 rgba(255,255,255,0.4) inset',
        }}>

        {/* Keyboard rows */}
        <div style={{ display: 'grid', gap: 3, marginBottom: 8 }}>
          {[14, 14, 13, 12].map((cols, row) => (
            <div key={row} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 2.5 }}>
              {Array.from({ length: cols }).map((_, i) => (
                <div key={i} style={{
                  height: 18,
                  borderRadius: 3,
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.65), rgba(255,255,255,0.25))',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.5)',
                }} />
              ))}
            </div>
          ))}
          {/* Space bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 4fr 1fr', gap: 2.5 }}>
            {[3, 3, 3].map((_, i) => (
              <div key={i} style={{
                height: 18,
                borderRadius: 3,
                background: i === 1
                  ? 'linear-gradient(to bottom, rgba(255,255,255,0.65), rgba(255,255,255,0.25))'
                  : 'rgba(255,255,255,0.3)',
                boxShadow: i === 1 ? '0 1px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.5)' : 'none',
              }} />
            ))}
          </div>
        </div>

        {/* Trackpad */}
        <div className="mx-auto" style={{
          width: 180,
          height: 52,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.22)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
        }} />
      </div>

      {/* Desk reflection */}
      <div style={{
        height: 24,
        marginInline: 16,
        borderRadius: '0 0 12px 12px',
        background: 'linear-gradient(to bottom, rgba(100,116,139,0.15), transparent)',
      }} />
    </motion.div>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const laptopRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const { scrollYProgress: laptopScroll } = useScroll({ target: laptopRef, offset: ['start 0.9', 'center 0.35'] });

  const blobY   = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const blobY2  = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const textY   = useTransform(scrollYProgress, [0, 0.3], [0, 28]);
  const fadeOut = useTransform(scrollYProgress, [0, 0.22], [1, 0]);

  const mouseX  = useMotionValue(50);
  const mouseY  = useMotionValue(50);
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

      {/* ── Above-fold text ── */}
      <motion.div style={{ y: textY, opacity: fadeOut }}
        className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-6">
        <motion.div variants={stagger(0.09)} initial="hidden" animate="show"
          className="flex flex-col items-center gap-6 text-center max-w-4xl mx-auto">

          <motion.div variants={blurUp} className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
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
            <span className="text-slate-900">One place for all</span><br />
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
              <Play size={14} className="fill-current text-amber-500" /> See How It Works
            </MagneticButton>
          </motion.div>

          <motion.div variants={fadeUp}>
            <p className="text-xs text-slate-500">No credit card required · Free to get started</p>
          </motion.div>
        </motion.div>

        <motion.div aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
          <span className="text-xs text-slate-400">Scroll to explore</span>
          <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border border-slate-300 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-amber-500/60 rounded-full" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── Laptop mockup ── */}
      <div ref={laptopRef} className="relative pb-32 pt-4 px-8">
        <LaptopMockup scrollYProgress={laptopScroll} />
      </div>
    </section>
  );
}
