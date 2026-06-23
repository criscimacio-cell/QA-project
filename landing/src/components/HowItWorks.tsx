import { motion, useScroll, useTransform, useSpring, useMotionValueEvent, MotionValue } from 'framer-motion';
import { useRef, useState } from 'react';
import { TrendingUp, Clock, ShieldCheck, Zap, Users, FileCheck } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';

const STATS = [
  {
    value: 87,
    suffix: '%',
    label: 'faster approvals',
    sub: 'Teams close review cycles in hours, not weeks.',
    icon: TrendingUp,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
  },
  {
    value: 0,
    prefix: '',
    suffix: '',
    display: 'Zero',
    label: 'lost documents',
    sub: 'Every file is versioned, tracked, and always findable.',
    icon: FileCheck,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
  },
  {
    value: 100,
    suffix: '%',
    label: 'audit coverage',
    sub: 'Every view, edit, and approval is logged immutably.',
    icon: ShieldCheck,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
  },
  {
    value: 5,
    suffix: ' min',
    label: 'to get started',
    sub: 'Import files, invite your team, start reviewing.',
    icon: Zap,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
  },
  {
    value: 3,
    suffix: 'x',
    label: 'more output per reviewer',
    sub: 'No more chasing people over email for sign-offs.',
    icon: Users,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
  },
  {
    value: 10,
    suffix: 'x',
    label: 'faster compliance audits',
    sub: 'Export full audit trails in seconds, not days.',
    icon: Clock,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
  },
];

function AnimatedNumber({ target, suffix, prefix, display, color, isInView }: {
  target: number;
  suffix?: string;
  prefix?: string;
  display?: string;
  color: string;
  isInView: boolean;
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Animate number from 0 to target
  const raw = useSpring(0, { stiffness: 60, damping: 20, mass: 1 });
  const [displayVal, setDisplayVal] = useState(0);

  useMotionValueEvent(raw, 'change', (v) => setDisplayVal(Math.round(v)));

  if (isInView && !shown) {
    raw.set(target);
    setShown(true);
  }

  if (display) {
    return <span style={{ color }}>{display}</span>;
  }

  return (
    <span ref={ref} style={{ color }}>
      {prefix}{displayVal}{suffix}
    </span>
  );
}

function StatCard({ stat, index, isInView, scrollYProgress }: {
  stat: typeof STATS[number];
  index: number;
  isInView: boolean;
  scrollYProgress: MotionValue<number>;
}) {
  const Icon = stat.icon;
  // Alternate left/right per card
  const fromRight = index % 2 === 0;

  const s0 = (index % 3) * 0.06;
  const s1 = s0 + 0.35;

  const rawX = useTransform(scrollYProgress, [s0, s1], [fromRight ? 120 : -120, 0]);
  const rawOp = useTransform(scrollYProgress, [s0, s0 + 0.2], [0, 1]);
  const rawRotY = useTransform(scrollYProgress, [s0, s1], [fromRight ? 25 : -25, 0]);
  const x = useSpring(rawX, { stiffness: 70, damping: 18, mass: 1 });

  return (
    <motion.div
      style={{ x, opacity: rawOp, rotateY: rawRotY, perspective: 800 }}
      className="relative group bg-white rounded-2xl border border-slate-100 p-7 flex flex-col gap-4 shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(200px circle at 40% 40%, ${stat.bg}, transparent 70%)` }} />

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: stat.bg }}>
        <Icon size={18} style={{ color: stat.color }} />
      </div>

      {/* Big number */}
      <div className="text-5xl sm:text-6xl font-black tracking-tight leading-none">
        <AnimatedNumber
          target={stat.value}
          suffix={stat.suffix}
          prefix={stat.prefix}
          display={stat.display}
          color={stat.color}
          isInView={isInView}
        />
      </div>

      {/* Label */}
      <div>
        <div className="text-base font-bold text-slate-800 mb-1">{stat.label}</div>
        <div className="text-sm text-slate-400 leading-relaxed">{stat.sub}</div>
      </div>

      {/* Bottom accent line */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 rounded-b-2xl"
        style={{ background: stat.color }}
        initial={{ width: '0%' }}
        animate={isInView ? { width: '100%' } : {}}
        transition={{ duration: 0.9, delay: 0.3 + index * 0.09, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.div>
  );
}

export default function Impact() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.85', 'center 0.4'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v > 0.05) setIsInView(true);
  });

  // Subtle parallax on the heading
  const { scrollYProgress: fullProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const headingY = useTransform(fullProgress, [0, 1], [-20, 20]);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      aria-labelledby="impact-heading"
      className="py-32 relative overflow-hidden scroll-mt-20"
    >
      {/* Background */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-white to-[#FAFAFA]" />
      <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />

      {/* Amber glow top-center */}
      <div aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div style={{ y: headingY }}>
          <motion.div
            variants={stagger(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="text-center mb-16"
          >
            <motion.div variants={blurUp}
              className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 mb-4">
              Real results
            </motion.div>
            <motion.h2
              id="impact-heading"
              variants={blurUp}
              className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4"
            >
              The numbers speak.
            </motion.h2>
            <motion.p variants={blurUp} className="text-slate-500 text-lg max-w-lg mx-auto">
              Teams that switch to Qlarity stop chasing approvals and start shipping faster.
            </motion.p>
          </motion.div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} index={i} isInView={isInView} scrollYProgress={scrollYProgress} />
          ))}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center text-xs text-slate-400 mt-10"
        >
          Based on internal benchmarks from early access teams · Individual results may vary
        </motion.p>
      </div>
    </section>
  );
}
