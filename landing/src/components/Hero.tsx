import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { ArrowRight, Play, CheckCircle2, Sparkles } from 'lucide-react';

const BADGES = ['SOC 2 Ready', 'Multi-tenant', 'Role-based Access'];

const FLOAT_CARDS = [
  { label: 'Files Approved', value: '1,284', color: 'text-emerald-400', dot: 'bg-emerald-400', pos: '-right-4 top-12', delay: 0 },
  { label: 'Pending Review', value: '23', color: 'text-amber-400', dot: 'bg-amber-400', pos: '-left-8 bottom-16', delay: 0.15 },
  { label: 'Team Members', value: '47', color: 'text-blue-400', dot: 'bg-blue-400', pos: '-right-2 bottom-8', delay: 0.3 },
];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  // Spotlight follow cursor
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);
  const smoothX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 60, damping: 20 });

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

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
  };

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 noise">
      {/* Background layers */}
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950" />

      {/* Radial amber glow */}
      <motion.div
        style={{
          y, opacity,
          background: 'radial-gradient(circle, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0.05) 40%, transparent 70%)',
        }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
      />

      {/* Rotating beam */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{ y, opacity }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(245,158,11,0.08) 30deg, transparent 60deg)',
          }}
        />
      </motion.div>

      {/* Spotlight follow */}
      <div ref={containerRef} className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(600px circle at ${smoothX.get()}% ${smoothY.get()}%, rgba(245,158,11,0.06), transparent 60%)`,
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 text-center">
        <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col items-center gap-6">

          {/* Badge row */}
          <motion.div variants={item} className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/25 text-amber-400">
              <Sparkles size={11} />
              Now with AI-powered search
            </span>
            {BADGES.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-400"
              >
                <CheckCircle2 size={11} className="text-amber-400" />
                {b}
              </span>
            ))}
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]"
          >
            <span className="text-gradient-white">QA Asset Management,</span>
            <br />
            <span className="text-gradient">Finally Organized.</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={item}
            className="max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed"
          >
            Qlarity centralizes your QA files, knowledge base, and test data in one platform —
            with approval workflows, audit trails, and role-based access built in.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={item} className="flex flex-wrap gap-3 justify-center">
            <motion.a
              href="/register"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="shimmer-btn inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-7 py-3.5 rounded-xl text-sm transition-colors duration-200 glow-amber-sm"
            >
              Start for Free
              <ArrowRight size={16} />
            </motion.a>
            <motion.a
              href="#how-it-works"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/12 text-white font-medium px-7 py-3.5 rounded-xl text-sm transition-all duration-200"
            >
              <Play size={14} className="fill-current" />
              See How It Works
            </motion.a>
          </motion.div>

          {/* Social proof micro */}
          <motion.div variants={item} className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {['#F59E0B', '#6366F1', '#10B981', '#3B82F6'].map((c, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: c }}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Trusted by <span className="text-slate-300 font-medium">500+ QA teams</span> · No credit card required
            </p>
          </motion.div>

          {/* App preview */}
          <motion.div
            variants={item}
            className="relative mt-8 w-full max-w-4xl"
          >
            {/* Floating stat cards */}
            {FLOAT_CARDS.map((card) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.8 + card.delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`absolute ${card.pos} z-10 card-glass rounded-xl px-4 py-3 hidden lg:flex flex-col gap-0.5 cursor-default`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${card.dot} animate-pulse`} />
                  <span className="text-xs text-slate-400">{card.label}</span>
                </div>
                <span className={`text-xl font-bold ${card.color}`}>{card.value}</span>
              </motion.div>
            ))}

            {/* Mock app window */}
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl overflow-hidden amber-border-glow glow-amber"
            >
              {/* Window bar */}
              <div className="bg-slate-900 px-4 py-3 flex items-center gap-2 border-b border-white/8">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <div className="flex-1 mx-4 bg-slate-800 rounded-md h-5 flex items-center px-3">
                  <span className="text-slate-500 text-xs">app.qlarity.io/files</span>
                </div>
                <div className="w-16 h-5 bg-amber-500/20 border border-amber-500/30 rounded text-amber-400 text-[10px] flex items-center justify-center font-medium">
                  LIVE
                </div>
              </div>

              {/* Mock UI */}
              <div className="bg-slate-900/80 p-6 min-h-[320px] flex gap-4">
                {/* Sidebar stub */}
                <div className="hidden sm:flex flex-col gap-2 w-44 flex-shrink-0">
                  {['Dashboard', 'Repositories', 'File Manager', 'Knowledge Base', 'Test Data'].map((navItem, i) => (
                    <div
                      key={navItem}
                      className={`h-8 rounded-lg flex items-center px-3 text-xs ${
                        i === 2 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/3 text-slate-500'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mr-2 ${i === 2 ? 'bg-amber-400' : 'bg-slate-600'}`} />
                      {navItem}
                    </div>
                  ))}
                </div>

                {/* Content area */}
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="h-5 bg-white/10 rounded w-32" />
                    <div className="h-7 bg-amber-500/20 border border-amber-500/30 rounded-lg w-24" />
                  </div>
                  {[
                    { name: 'TC_Login_Flow_v3.xlsx', status: 'approved', color: 'bg-emerald-500/20 text-emerald-400' },
                    { name: 'API_Regression_Suite.json', status: 'under review', color: 'bg-amber-500/20 text-amber-400' },
                    { name: 'UI_Smoke_Test_Data.csv', status: 'draft', color: 'bg-slate-500/20 text-slate-400' },
                    { name: 'Performance_Baseline.xlsx', status: 'published', color: 'bg-blue-500/20 text-blue-400' },
                  ].map((file) => (
                    <motion.div
                      key={file.name}
                      whileHover={{ x: 3, transition: { duration: 0.2 } }}
                      className="flex items-center gap-3 bg-white/3 hover:bg-white/6 rounded-xl px-4 py-3 border border-white/5 hover:border-white/10 transition-colors cursor-default"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-300 truncate">{file.name}</div>
                        <div className="text-xs text-slate-600 mt-0.5">Modified 2h ago</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${file.color}`}>{file.status}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Bottom fade */}
            <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-950 to-transparent rounded-b-2xl pointer-events-none" />
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-slate-600">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-2 bg-amber-400/60 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
