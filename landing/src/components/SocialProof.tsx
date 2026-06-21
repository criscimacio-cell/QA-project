import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { blurUp, stagger } from '../lib/animations';

const STATS = [
  { value: 2400000, suffix: '+', label: 'Documents managed', display: '2.4M' },
  { value: 800, suffix: '+', label: 'Organizations' },
  { value: 99.9, suffix: '%', label: 'Uptime SLA', decimals: 1 },
  { value: 60, suffix: '%', label: 'Faster approvals', prefix: 'Up to ' },
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
        {stat.prefix ?? ''}<span ref={ref}>{stat.display ? stat.display : count.toLocaleString()}</span>{stat.suffix}
      </div>
      <div className="text-sm text-slate-500">{stat.label}</div>
    </motion.div>
  );
}

export default function SocialProof() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  return (
    <section ref={ref} className="py-24 relative overflow-hidden bg-white">
      <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </motion.div>

      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          className="text-center mb-16"
        >
          <motion.div variants={blurUp}
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 mb-4">
            Trusted by teams worldwide
          </motion.div>
          <motion.h2 variants={blurUp} className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Numbers that speak for themselves
          </motion.h2>
          <motion.p variants={blurUp} className="text-slate-500 text-lg max-w-lg mx-auto">
            From startups to enterprises — teams use Qlarity to bring order to their documents.
          </motion.p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((s, i) => <StatItem key={s.label} stat={s} index={i} />)}
        </div>
      </div>
    </section>
  );
}
