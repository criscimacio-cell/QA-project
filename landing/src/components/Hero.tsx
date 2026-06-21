import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';

const BADGES = ['SOC 2 Ready', 'Version Control', 'Role-based Access'];

const FLOAT_CARDS = [
  { label: 'Documents Stored', value: '48,291', color: 'text-emerald-600', dot: 'bg-emerald-500', pos: '-right-4 top-12', delay: 0, dy: -20 },
  { label: 'Pending Approval', value: '12', color: 'text-amber-600', dot: 'bg-amber-500', pos: '-left-8 bottom-16', delay: 0.15, dy: 20 },
  { label: 'Active Users', value: '134', color: 'text-blue-600', dot: 'bg-blue-500', pos: '-right-2 bottom-8', delay: 0.3, dy: 15 },
];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const blobY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const blobY2 = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const fadeOut = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const scaleDown = useTransform(scrollYProgress, [0, 0.6], [1, 0.94]);
  const mockY = useTransform(scrollYProgress, [0, 1], [0, 40]);

  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 18 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 18 });

  useEffect(() => {
    const el = containerRef.current;
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
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FAFAFA]/20 to-[#FAFAFA]" />

      <motion.div
        style={{ y: blobY, opacity: fadeOut }}
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}
      >
        <div style={{ width: '100%', height: '100%', background: 'radial-gradient(ellipse, rgba(245,158,11,0.11) 0%, rgba(252,211,77,0.06) 45%, transparent 70%)', filter: 'blur(50px)' }} />
      </motion.div>

      <motion.div
        style={{ y: blobY2, opacity: fadeOut }}
        className="absolute top-32 right-[15%] w-[350px] h-[350px] rounded-full pointer-events-none"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, delay: 0.2 }}
      >
        <div style={{ width: '100%', height: '100%', background: 'radial-gradient(circle, rgba(251,191,36,0.09) 0%, transparent 70%)', filter: 'blur(55px)' }} />
      </motion.div>

      <div ref={containerRef} className="absolute inset-0 pointer-events-none">
        <motion.div className="absolute inset-0" style={{ background: `radial-gradient(480px circle at ${smoothX.get()}% ${smoothY.get()}%, rgba(245,158,11,0.055), transparent 65%)` }} />
      </div>

      <motion.div style={{ y: textY, opacity: fadeOut, scale: scaleDown }} className="relative max-w-6xl mx-auto px-6 text-center">
        <motion.div variants={stagger(0.09)} initial="hidden" animate="show" className="flex flex-col items-center gap-6">

          <motion.div variants={blurUp} className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
              <Sparkles size={11} />
              Smart document intelligence
            </span>
            {BADGES.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-500 shadow-sm">
                <CheckCircle2 size={11} className="text-amber-500" />
                {b}
              </span>
            ))}
          </motion.div>

          <motion.h1 variants={blurUp} className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]">
            <span className="text-slate-900">One place for all</span>
            <br />
            <span className="text-gradient">your documents.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="max-w-2xl text-lg sm:text-xl text-slate-500 leading-relaxed">
            Qlarity is a modern document management system — store, version, review, and publish
            files across your organization with approval workflows and audit trails built in.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3 justify-center">
            <motion.a href="/register" whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }}
              className="shimmer-btn inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-7 py-3.5 rounded-xl text-sm transition-colors glow-amber-sm">
              Start for Free <ArrowRight size={16} />
            </motion.a>
            <motion.a href="#how-it-works" whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium px-7 py-3.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md">
              <Play size={14} className="fill-current text-amber-500" />
              See How It Works
            </motion.a>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {['#F59E0B', '#6366F1', '#10B981', '#3B82F6'].map((c, i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ background: c }} />
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Trusted by <span className="text-slate-700 font-medium">500+ teams</span> · No credit card required
            </p>
          </motion.div>

          {/* App preview */}
          <motion.div variants={fadeUp} style={{ y: mockY }} className="relative mt-8 w-full max-w-4xl">
            {FLOAT_CARDS.map((card) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: card.dy, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.9 + card.delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6, scale: 1.04, transition: { duration: 0.2 } }}
                className={`absolute ${card.pos} z-10 bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-3 hidden lg:flex flex-col gap-0.5 cursor-default`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${card.dot} animate-pulse`} />
                  <span className="text-xs text-slate-500">{card.label}</span>
                </div>
                <span className={`text-xl font-bold ${card.color}`}>{card.value}</span>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6 }}
              className="rounded-2xl overflow-hidden amber-border-glow"
            >
              <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 mx-4 bg-white border border-slate-200 rounded-md h-5 flex items-center px-3 shadow-sm">
                  <span className="text-slate-400 text-xs">app.qlarity.io/documents</span>
                </div>
                <div className="w-16 h-5 bg-amber-50 border border-amber-200 rounded text-amber-600 text-[10px] flex items-center justify-center font-semibold">LIVE</div>
              </div>

              <div className="bg-white p-6 min-h-[320px] flex gap-4">
                <div className="hidden sm:flex flex-col gap-2 w-44 flex-shrink-0">
                  {['Dashboard', 'Documents', 'Shared with Me', 'Templates', 'Archive'].map((navItem, i) => (
                    <div key={navItem} className={`h-8 rounded-lg flex items-center px-3 text-xs ${i === 1 ? 'bg-amber-50 text-amber-700 border border-amber-200 font-medium' : 'bg-slate-50 text-slate-500 border border-transparent'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full mr-2 ${i === 1 ? 'bg-amber-500' : 'bg-slate-300'}`} />
                      {navItem}
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="h-5 bg-slate-100 rounded w-28" />
                    <div className="h-7 bg-amber-50 border border-amber-200 rounded-lg w-24" />
                  </div>
                  {[
                    { name: 'Q4_Finance_Report_v2.pdf', status: 'approved', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
                    { name: 'Employee_Handbook_2025.docx', status: 'in review', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
                    { name: 'Product_Roadmap_Draft.pptx', status: 'draft', color: 'bg-slate-100 text-slate-500 border border-slate-200' },
                    { name: 'Legal_NDA_Template.pdf', status: 'published', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
                  ].map((file) => (
                    <motion.div key={file.name} whileHover={{ x: 4, transition: { duration: 0.15 } }}
                      className="flex items-center gap-3 bg-slate-50 hover:bg-white rounded-xl px-4 py-3 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all cursor-default">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-700 truncate font-medium">{file.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Updated 3h ago</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${file.color}`}>{file.status}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#FAFAFA] to-transparent rounded-b-2xl pointer-events-none" />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
        style={{ opacity: useTransform(scrollYProgress, [0, 0.08], [1, 0]) }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-slate-400">Scroll to explore</span>
        <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 rounded-full border border-slate-300 flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 bg-amber-500/60 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
