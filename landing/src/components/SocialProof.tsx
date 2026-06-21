import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';

const STATS = [
  { value: 10000, suffix: '+', label: 'Assets managed' },
  { value: 500, suffix: '+', label: 'QA teams' },
  { value: 99.9, suffix: '%', label: 'Uptime SLA', decimals: 1 },
  { value: 200, prefix: '< ', suffix: 'ms', label: 'Avg response time' },
];

const TESTIMONIALS = [
  { quote: "Qlarity cut our approval turnaround time in half. Everything is in one place — no more Slack threads hunting for the latest test data file.", name: 'Sarah K.', role: 'QA Lead, Fintech startup', avatar: 'SK', color: 'bg-amber-500' },
  { quote: "The RBAC system is exactly what we needed. I can give contractors access to specific modules without worrying about sensitive data.", name: 'Marcus T.', role: 'Engineering Manager', avatar: 'MT', color: 'bg-blue-500' },
  { quote: "Audit logs alone saved us during our last compliance review. Every action, timestamped, attributed. The auditors were impressed.", name: 'Priya N.', role: 'QA Director', avatar: 'PN', color: 'bg-violet-500' },
  { quote: "Finally a tool built for QA teams. The knowledge base replaced our scattered Confluence pages overnight.", name: 'James R.', role: 'Senior QA Engineer', avatar: 'JR', color: 'bg-emerald-500' },
  { quote: "Setting up multi-step approval workflows took 10 minutes. The whole team was onboarded by end of day.", name: 'Lena M.', role: 'QA Manager', avatar: 'LM', color: 'bg-rose-500' },
  { quote: "Full-text search across all our repos is a game changer. No more digging through folders for a test case from 6 months ago.", name: 'David C.', role: 'Automation Lead', avatar: 'DC', color: 'bg-cyan-500' },
];

function useCountUp(target: number, duration = 1800, decimals = 0) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(parseFloat((eased * target).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration, decimals]);

  return { ref, count };
}

function StatItem({ stat, index }: { stat: typeof STATS[number]; index: number }) {
  const { ref, count } = useCountUp(stat.value, 1800, stat.decimals ?? 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="text-center"
    >
      <div className="text-3xl sm:text-4xl font-bold text-gradient mb-1">
        {stat.prefix ?? ''}<span ref={ref}>{count}</span>{stat.suffix}
      </div>
      <div className="text-sm text-slate-500">{stat.label}</div>
    </motion.div>
  );
}

function TestimonialCard({ t }: { t: typeof TESTIMONIALS[number] }) {
  return (
    <motion.div
      whileHover={{ y: -5, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', transition: { duration: 0.2 } }}
      className="flex-shrink-0 w-80 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col gap-4 mx-3 cursor-default"
    >
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} className="text-amber-400 fill-amber-400" />)}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed flex-1">"{t.quote}"</p>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>{t.avatar}</div>
        <div>
          <div className="text-sm font-medium text-slate-800">{t.name}</div>
          <div className="text-xs text-slate-400">{t.role}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SocialProof() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [-30, 30]);
  const doubled = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section ref={ref} className="py-24 relative overflow-hidden bg-white">
      {/* Subtle parallax amber wash */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </motion.div>

      {/* Fade edges for marquee */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, #ffffff, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, #ffffff, transparent)' }} />

      <div className="max-w-6xl mx-auto px-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
          {STATS.map((s, i) => <StatItem key={s.label} stat={s} index={i} />)}
        </div>

        {/* Header */}
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="text-center mb-12"
        >
          <motion.div variants={blurUp}
            className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-xs font-medium text-emerald-700 mb-4">
            <Star size={12} className="fill-emerald-500 text-emerald-500" />
            5.0 average rating
          </motion.div>
          <motion.h2 variants={blurUp} className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Loved by QA teams
          </motion.h2>
        </motion.div>
      </div>

      {/* Marquee */}
      <div className="overflow-hidden pb-4">
        <div className="marquee-track">
          {doubled.map((t, i) => <TestimonialCard key={i} t={t} />)}
        </div>
      </div>
    </section>
  );
}
