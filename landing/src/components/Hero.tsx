import { motion, useScroll, useTransform, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

const FILES = [
  { name: 'Q4_Finance_Report_v2.pdf',     status: 'approved',  sc: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Employee_Handbook_2025.docx',  status: 'in review', sc: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: 'Product_Roadmap_Draft.pptx',   status: 'draft',     sc: 'bg-slate-100 text-slate-500 border-slate-200' },
  { name: 'Legal_NDA_Template.pdf',       status: 'published', sc: 'bg-blue-50 text-blue-700 border-blue-200' },
];

const NAV = ['Dashboard', 'Documents', 'Shared with Me', 'Templates', 'Archive'];

// ─────────────────────────────────────────────────────────────────
// True 3D laptop side-view component.
//
// Scene layout (preserve-3d):
//   • Base  — laid flat with rotateX(90deg), depth = DEPTH px
//   • Screen — hinged at rear of base, rotateX = open angle (~-20deg past vertical)
//   • Whole assembly: rotateY driven by scroll (75° side → 18° front)
// ─────────────────────────────────────────────────────────────────
const W = 680;        // laptop width (px)
const DEPTH = 220;    // base depth front-to-back (px)
const SCREEN_H = 420; // screen height (px)
const BASE_T = 14;    // base thickness (px, the visible side strip)
const OPEN_X = -22;   // screen open angle past vertical (negative = tilted back)

function LaptopScene({ scrollYProgress }: { scrollYProgress: ReturnType<typeof useScroll>['scrollYProgress'] }) {
  // Scroll: side view → angled front view
  const rawRotY  = useTransform(scrollYProgress, [0, 1], [72, 16]);
  const rawScale = useTransform(scrollYProgress, [0, 0.5], [0.82, 1]);
  const opacity  = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

  const rotateY = useSpring(rawRotY,  { stiffness: 55, damping: 20 });
  const sc      = useSpring(rawScale, { stiffness: 55, damping: 20 });

  return (
    <motion.div
      style={{ opacity, scale: sc }}
      className="flex items-center justify-center w-full"
      aria-hidden="true"
    >
      {/* Perspective wrapper — sets the 3D stage */}
      <div style={{ perspective: 1400, perspectiveOrigin: '50% 60%', width: W }}>
        <motion.div
          style={{
            width: W,
            height: SCREEN_H + BASE_T + 8,
            rotateY,
            transformStyle: 'preserve-3d',
            position: 'relative',
          }}
        >

          {/* ── BASE (laid flat via rotateX 90°) ───────────── */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: W,
            height: DEPTH,
            transformOrigin: 'top center',
            transform: 'rotateX(90deg)',
            transformStyle: 'preserve-3d',
            borderRadius: '0 0 20px 20px',
            background: 'linear-gradient(180deg, #d1d5db 0%, #b0b5bc 50%, #c4c8ce 100%)',
          }}>
            {/* Keyboard rows */}
            <div style={{ padding: '16px 20px 10px', display: 'grid', gap: 4 }}>
              {[13, 13, 13, 13].map((cols, row) => (
                <div key={row} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3 }}>
                  {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} style={{
                      height: 20,
                      borderRadius: 3,
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(255,255,255,0.2))',
                      boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.15)',
                    }} />
                  ))}
                </div>
              ))}
              {/* Space bar row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1fr', gap: 3, marginTop: 2 }}>
                <div style={{ height: 20, borderRadius: 3, background: 'rgba(255,255,255,0.4)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.15)' }} />
                <div style={{ height: 20, borderRadius: 3, background: 'linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(255,255,255,0.2))', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.15)' }} />
                <div style={{ height: 20, borderRadius: 3, background: 'rgba(255,255,255,0.4)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.15)' }} />
              </div>
            </div>
            {/* Trackpad */}
            <div style={{
              margin: '6px auto 0',
              width: 160,
              height: 50,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.25)',
              border: '1px solid rgba(255,255,255,0.4)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
            }} />
          </div>

          {/* ── BASE SIDE STRIP (visible from side view) ───── */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: W,
            height: BASE_T,
            background: 'linear-gradient(to bottom, #9ca3af 0%, #6b7280 100%)',
            borderRadius: '0 0 14px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          }} />

          {/* ── SCREEN LID ──────────────────────────────────── */}
          <div style={{
            position: 'absolute',
            bottom: BASE_T,
            left: 0,
            width: W,
            height: SCREEN_H,
            transformOrigin: 'bottom center',
            transform: `rotateX(${OPEN_X}deg)`,
            transformStyle: 'preserve-3d',
          }}>
            {/* Lid outer shell — aluminum */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(160deg, #d1d5db 0%, #a8acb3 50%, #9ca3af 100%)',
              borderRadius: '18px 18px 0 0',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
            }}>
              {/* Apple-style logo mark */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 32, height: 32,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
              }} />
            </div>

            {/* Screen face — front only */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              borderRadius: '18px 18px 0 0',
              overflow: 'hidden',
            }}>
              {/* Dark bezel frame */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: '#1a1a1a',
                borderRadius: '18px 18px 0 0',
              }} />

              {/* Camera dot */}
              <div style={{
                position: 'absolute',
                top: 9, left: '50%',
                transform: 'translateX(-50%)',
                width: 6, height: 6,
                borderRadius: '50%',
                background: '#2d2d2d',
                border: '1px solid #3a3a3a',
                zIndex: 10,
              }} />

              {/* Glass / screen */}
              <div style={{
                position: 'absolute',
                inset: '22px 10px 8px',
                background: 'white',
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                {/* App chrome */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                  <div style={{ flex: 1, marginLeft: 8, height: 16, background: 'white', border: '1px solid #e2e8f0', borderRadius: 4, display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                    <span style={{ fontSize: 7, color: '#94a3b8', fontFamily: 'system-ui' }}>app.qlarity.io</span>
                  </div>
                </div>

                {/* App layout */}
                <div style={{ display: 'flex', height: 'calc(100% - 29px)' }}>
                  {/* Sidebar */}
                  <div style={{ width: 130, flexShrink: 0, background: '#f8fafc', borderRight: '1px solid #f1f5f9', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', marginBottom: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, background: '#f59e0b', flexShrink: 0 }} />
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#1e293b', fontFamily: 'system-ui' }}>Qlarity</span>
                    </div>
                    {NAV.map((item, i) => (
                      <div key={item} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 6px', borderRadius: 5,
                        background: i === 1 ? '#fef3c7' : 'transparent',
                        fontSize: 7, fontWeight: i === 1 ? 600 : 400,
                        color: i === 1 ? '#b45309' : '#64748b',
                        fontFamily: 'system-ui',
                      }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: i === 1 ? '#f59e0b' : '#cbd5e1', flexShrink: 0 }} />
                        {item}
                      </div>
                    ))}
                  </div>

                  {/* Main panel */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#1e293b', fontFamily: 'system-ui' }}>Documents</div>
                        <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 1, fontFamily: 'system-ui' }}>4 files</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <div style={{ height: 16, padding: '0 6px', background: '#f1f5f9', borderRadius: 4, fontSize: 7, color: '#64748b', display: 'flex', alignItems: 'center', fontFamily: 'system-ui' }}>Filter</div>
                        <div style={{ height: 16, padding: '0 6px', background: '#f59e0b', borderRadius: 4, fontSize: 7, color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', fontFamily: 'system-ui' }}>+ Upload</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
                      {FILES.map((f, i) => (
                        <motion.div key={f.name}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.8 + i * 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'white', border: '1px solid #f1f5f9', borderRadius: 6 }}>
                          <div style={{ width: 18, height: 20, borderRadius: 3, background: '#fef3c7', border: '1px solid #fde68a', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 7, color: '#334155', fontWeight: 500, fontFamily: 'system-ui', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                            <div style={{ fontSize: 6, color: '#94a3b8', marginTop: 1, fontFamily: 'system-ui' }}>Updated 3h ago</div>
                          </div>
                          <div style={{ fontSize: 6, padding: '1px 5px', borderRadius: 10, border: '1px solid', flexShrink: 0, fontFamily: 'system-ui' }}
                            className={f.sc}>{f.status}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── DROP SHADOW under laptop ─────────────────────── */}
          <div style={{
            position: 'absolute',
            bottom: -20,
            left: '10%',
            width: '80%',
            height: 30,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.18)',
            filter: 'blur(16px)',
            transform: 'translateZ(-60px)',
          }} />
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const laptopRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const { scrollYProgress: laptopScroll } = useScroll({ target: laptopRef, offset: ['start 0.85', 'center 0.35'] });

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
        <motion.div variants={stagger(0.09)} initial="hidden" animate="show" className="flex flex-col items-center gap-6 text-center max-w-4xl mx-auto">

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

      {/* ── 3D laptop side-view ── */}
      <div ref={laptopRef} className="relative pb-32 pt-8 px-6 overflow-hidden">
        <LaptopScene scrollYProgress={laptopScroll} />
      </div>
    </section>
  );
}
