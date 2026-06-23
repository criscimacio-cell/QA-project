import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle2, Sparkles, FileText, Eye, CheckCircle, Globe, Share2, ExternalLink, Star } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';
import { MagneticButton } from './ui/MagneticButton';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

// 3D floating shapes — spheres and tubes
const SHAPES = [
  // Large spheres
  { type: 'sphere', w: 180, h: 180, x: '62%', y: '5%',  gradient: 'radial-gradient(circle at 35% 32%, #a78bfa, #7c3aed 55%, #4c1d95)', shadow: '0 20px 60px rgba(124,58,237,0.45)', delay: 0,    dur: 5.2 },
  { type: 'sphere', w: 120, h: 120, x: '88%', y: '55%', gradient: 'radial-gradient(circle at 38% 30%, #fb7185, #e11d48 55%, #881337)', shadow: '0 16px 48px rgba(225,29,72,0.4)',    delay: 0.3,  dur: 4.6 },
  { type: 'sphere', w:  80, h:  80, x: '54%', y: '72%', gradient: 'radial-gradient(circle at 35% 30%, #34d399, #059669 55%, #064e3b)', shadow: '0 10px 32px rgba(5,150,105,0.4)',   delay: 0.6,  dur: 6.0 },
  { type: 'sphere', w:  56, h:  56, x: '96%', y: '12%', gradient: 'radial-gradient(circle at 35% 30%, #fcd34d, #f59e0b 55%, #92400e)', shadow: '0 8px 24px rgba(245,158,11,0.4)',   delay: 0.2,  dur: 4.0 },
  { type: 'sphere', w:  44, h:  44, x: '50%', y: '18%', gradient: 'radial-gradient(circle at 35% 30%, #93c5fd, #3b82f6 55%, #1e3a8a)', shadow: '0 6px 18px rgba(59,130,246,0.4)',   delay: 0.8,  dur: 5.5 },
  { type: 'sphere', w:  36, h:  36, x: '78%', y: '82%', gradient: 'radial-gradient(circle at 35% 30%, #c4b5fd, #8b5cf6 55%, #4c1d95)', shadow: '0 4px 14px rgba(139,92,246,0.4)',   delay: 1.0,  dur: 3.8 },
  // Tubes / cylinders
  { type: 'tube',   w: 140, h:  36, x: '57%', y: '88%', rot: -28, gradient: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 50%, #1d4ed8 100%)', shadow: '0 8px 24px rgba(37,99,235,0.4)',  delay: 0.4,  dur: 4.8 },
  { type: 'tube',   w: 110, h:  28, x: '90%', y: '38%', rot:  42, gradient: 'linear-gradient(135deg, #f9a8d4 0%, #ec4899 50%, #be185d 100%)', shadow: '0 6px 20px rgba(236,72,153,0.4)', delay: 0.7,  dur: 5.4 },
  { type: 'tube',   w:  80, h:  22, x: '53%', y: '42%', rot: -55, gradient: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 50%, #065f46 100%)', shadow: '0 5px 16px rgba(16,185,129,0.4)', delay: 0.15, dur: 4.2 },
  { type: 'tube',   w:  60, h:  18, x: '97%', y: '68%', rot:  20, gradient: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 50%, #92400e 100%)', shadow: '0 4px 12px rgba(245,158,11,0.4)',  delay: 0.9,  dur: 6.2 },
];

const FLOAT_BOB = [
  [0, -14, 0], [0, 10, 0], [0, -10, 0], [0, 12, 0], [0, -8, 0],
  [0, 8, 0],  [0, -12, 0], [0, 9, 0], [0, -7, 0], [0, 11, 0],
];

// Mini document status cards on the mockup
const DOC_ITEMS = [
  { file: 'Q4_Finance_Report.pdf', status: 'Approved',  icon: CheckCircle, color: '#10b981' },
  { file: 'Legal_NDA_v3.pdf',      status: 'In Review', icon: Eye,         color: '#f59e0b' },
  { file: 'Brand_Guidelines.pdf',  status: 'Published', icon: Globe,       color: '#8b5cf6' },
];

export default function Hero() {
  const heroRef   = useRef<HTMLElement>(null);
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);
  const mx = useSpring(rawMouseX, { stiffness: 30, damping: 20, mass: 1 });
  const my = useSpring(rawMouseY, { stiffness: 30, damping: 20, mass: 1 });

  // Subtle tilt on the mockup
  const tiltX = useTransform(my, [-1, 1], [6, -6]);
  const tiltY = useTransform(mx, [-1, 1], [-8, 8]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      rawMouseX.set(((e.clientX - rect.left) / rect.width  - 0.5) * 2);
      rawMouseY.set(((e.clientY - rect.top)  / rect.height - 0.5) * 2);
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, [rawMouseX, rawMouseY]);

  return (
    <section ref={heroRef} className="relative overflow-hidden min-h-screen flex items-center bg-white">

      {/* Subtle grid */}
      <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

      {/* Soft left ambient */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 70% at 15% 55%, rgba(245,158,11,0.06) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-7xl mx-auto px-8 lg:px-16 py-24 pt-32 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* ── LEFT: Copy ─────────────────────────────────────────── */}
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-7 z-10"
        >
          {/* Label */}
          <motion.div variants={blurUp} className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 uppercase tracking-wide">
              <Sparkles size={10} /> Document Management
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={blurUp}
            className="text-5xl sm:text-6xl lg:text-[4.2rem] font-black tracking-tight leading-[1.06] text-slate-900">
            One place for<br />
            <span className="text-gradient">all your</span><br />
            documents.
          </motion.h1>

          <motion.p variants={blurUp} className="text-lg text-slate-500 leading-relaxed max-w-md">
            Qlarity keeps every file, approval, and version in one place — so nothing gets lost in email threads or shared drives.
          </motion.p>

          {/* Feature badges */}
          <motion.div variants={blurUp} className="flex flex-wrap gap-2">
            {BADGES.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600">
                <CheckCircle2 size={11} className="text-amber-500" /> {b}
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div variants={blurUp} className="flex flex-wrap gap-3">
            <MagneticButton href="/register"
              className="shimmer-btn inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-4 rounded-2xl text-sm transition-colors shadow-xl shadow-amber-200/70 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              Get Started Free <ArrowRight size={16} />
            </MagneticButton>
            <MagneticButton href="#how-it-works" strength={0.22}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 font-semibold px-8 py-4 rounded-2xl text-sm transition-all shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              Not Now
            </MagneticButton>
          </motion.div>

          {/* Social links */}
          <motion.div variants={blurUp} className="flex items-center gap-4 pt-2">
            {[Share2, ExternalLink, Star].map((Icon, i) => (
              <a key={i} href="#" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-amber-50 hover:text-amber-600 border border-slate-200 flex items-center justify-center text-slate-400 transition-colors">
                <Icon size={14} />
              </a>
            ))}
          </motion.div>
        </motion.div>

        {/* ── RIGHT: 3D Scene ────────────────────────────────────── */}
        <div className="relative h-[520px] lg:h-[600px]">

          {/* Floating 3D shapes */}
          {SHAPES.map((s, i) => (
            <Shape key={i} shape={s} bob={FLOAT_BOB[i % FLOAT_BOB.length]} mx={mx} my={my} />
          ))}

          {/* App Mockup — center of the scene */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 5 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              rotateX: tiltX,
              rotateY: tiltY,
              perspective: 1200,
            }}
          >
            <div
              className="bg-white rounded-2xl overflow-hidden"
              style={{
                width: 300,
                boxShadow: '0 32px 80px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)',
              }}
            >
              {/* App chrome */}
              <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-3">
                  <div className="bg-slate-700 rounded-md px-3 py-1 text-[9px] text-slate-400 text-center">app.qlarity.io/documents</div>
                </div>
              </div>

              {/* Sidebar + content */}
              <div className="flex" style={{ height: 320 }}>
                {/* Sidebar */}
                <div className="bg-slate-50 border-r border-slate-100 p-3 flex flex-col gap-2" style={{ width: 72 }}>
                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-1">Menu</div>
                  {['Docs', 'Review', 'Team', 'Audit'].map((item, i) => (
                    <div key={item}
                      className={`rounded-lg px-2 py-1.5 text-[8px] font-semibold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>
                      {item}
                    </div>
                  ))}
                </div>

                {/* Main */}
                <div className="flex-1 p-3 flex flex-col gap-2 bg-white overflow-hidden">
                  <div className="text-[9px] font-bold text-slate-700 mb-1">Recent Documents</div>
                  {DOC_ITEMS.map((doc) => {
                    const Icon = doc.icon;
                    return (
                      <div key={doc.file}
                        className="flex items-center gap-2 rounded-xl p-2 hover:bg-slate-50 border border-slate-100">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${doc.color}15` }}>
                          <FileText size={10} style={{ color: doc.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[8px] font-semibold text-slate-700 truncate">{doc.file}</div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Icon size={8} style={{ color: doc.color }} />
                          <span className="text-[7px] font-bold" style={{ color: doc.color }}>{doc.status}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Approval pipeline */}
                  <div className="mt-auto pt-2 border-t border-slate-100">
                    <div className="text-[8px] font-bold text-slate-500 mb-2">Approval Pipeline</div>
                    <div className="flex items-center gap-1">
                      {['Upload', 'Review', 'Sign-off', 'Publish'].map((step, i) => (
                        <div key={step} className="flex items-center gap-1">
                          <div className={`rounded-full px-1.5 py-0.5 text-[6px] font-bold ${i < 2 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {step}
                          </div>
                          {i < 3 && <div className={`w-3 h-px ${i < 1 ? 'bg-amber-400' : 'bg-slate-200'}`} />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Shape({ shape, bob, mx, my }: {
  shape: typeof SHAPES[number];
  bob: number[];
  mx: ReturnType<typeof useSpring>;
  my: ReturnType<typeof useSpring>;
}) {
  const px = useTransform(mx, [-1, 1], [-12, 12]);
  const py = useTransform(my, [-1, 1], [-8, 8]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 + shape.delay, duration: 1, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        left: shape.x,
        top: shape.y,
        zIndex: 2,
      }}
    >
      <motion.div style={{ x: px, y: py }}>
        <motion.div
          animate={{ y: bob }}
          transition={{ duration: shape.dur, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }}
        >
          <div
            style={{
              width: shape.w,
              height: shape.h,
              background: shape.gradient,
              borderRadius: shape.type === 'sphere' ? '50%' : '999px',
              boxShadow: `${shape.shadow}, inset -${Math.round(shape.w * 0.08)}px -${Math.round(shape.h * 0.08)}px ${Math.round(shape.w * 0.15)}px rgba(0,0,0,0.2)`,
              transform: shape.type === 'tube' ? `rotate(${(shape as { rot?: number }).rot ?? 0}deg)` : undefined,
            }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
