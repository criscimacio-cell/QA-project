import { motion, useScroll, useTransform, useSpring, useMotionTemplate, useReducedMotion, MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { FileCheck, ShieldCheck, Zap, Users } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';

const PILLARS = [
  { icon: FileCheck, title: 'Built for documents', desc: 'Every feature is designed around how real teams handle files — not bolted on after the fact.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', glow: '245,158,11' },
  { icon: ShieldCheck, title: 'Security first', desc: 'Role-based access, audit trails, and version history mean you always know who did what, when.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', glow: '59,130,246' },
  { icon: Zap, title: 'Fast to set up', desc: 'No lengthy onboarding. Import your files, invite your team, and start reviewing documents on day one.', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', glow: '139,92,246' },
  { icon: Users, title: 'Made for teams', desc: 'From solo founders to large departments — Qlarity grows with you without adding unnecessary complexity.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', glow: '16,185,129' },
];

// Cards sit at these fractional positions across the row (left→right)
const CARD_CENTERS = [0.14, 0.38, 0.62, 0.86];

function PillarCard({
  p,
  index,
  smoothProgress,
}: {
  p: typeof PILLARS[number];
  index: number;
  smoothProgress: MotionValue<number>;
}) {
  const reduce = useReducedMotion();
  const threshold = CARD_CENTERS[index];

  // Each card's reveal window — activates as the spotlight beam passes over it
  const cardProgress = useTransform(
    smoothProgress,
    [Math.max(0, threshold - 0.18), threshold + 0.1],
    [0, 1],
  );

  const cardOpacity = useTransform(cardProgress, [0, 1], [0.12, 1]);
  const cardY       = useTransform(cardProgress, [0, 1], [16, 0]);
  const cardScale   = useTransform(cardProgress, [0, 1], [0.96, 1]);
  const iconFilter  = useTransform(cardProgress, [0, 1], [0.4, 1]);
  const glowOpacity = useTransform(cardProgress, [0.4, 1], [0, 1]);

  const iconBrightness = useMotionTemplate`saturate(${iconFilter}) brightness(${iconFilter})`;

  return (
    <motion.div
      style={reduce ? {} : { opacity: cardOpacity, y: cardY, scale: cardScale }}
      whileHover={{ transform: 'translateY(-5px)', transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
      className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow cursor-default group h-full relative overflow-hidden"
    >
      {/* Per-card color bloom as spotlight activates it */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={reduce ? {} : {
          opacity: glowOpacity,
          background: `radial-gradient(200px circle at 30% 40%, rgba(${p.glow},0.09), transparent 70%)`,
        }}
      />

      <motion.div
        className={`relative z-10 w-10 h-10 rounded-xl ${p.bg} border ${p.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}
        style={reduce ? {} : { filter: iconBrightness }}
      >
        <p.icon size={18} className={p.color} />
      </motion.div>

      <div className="relative z-10 flex-1">
        <h3 className="text-sm font-semibold text-slate-800 mb-1.5">{p.title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
      </div>
    </motion.div>
  );
}

export default function SocialProof() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.75', 'center 0.4'],
  });

  // Spring so the spotlight has smooth momentum, not choppy scroll steps
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 18, mass: 1 });

  // Spotlight beam x-position sweeps 0→100% of the card row
  const spotX  = useTransform(smoothProgress, [0, 1], [-10, 110]);
  const spotBg = useMotionTemplate`radial-gradient(380px 260px ellipse at ${spotX}% 50%, rgba(245,158,11,0.13) 0%, rgba(245,158,11,0.04) 45%, transparent 70%)`;
  const lineLeft = useMotionTemplate`${spotX}%`;

  return (
    <section
      ref={sectionRef}
      id="why-qlarity"
      aria-labelledby="why-qlarity-heading"
      className="py-32 relative overflow-hidden bg-white"
    >
      <div aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center mb-16"
        >
          <motion.div variants={blurUp}
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 mb-4">
            Why Qlarity
          </motion.div>
          <motion.h2 id="why-qlarity-heading" variants={blurUp} className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            A better way to manage documents
          </motion.h2>
          <motion.p variants={blurUp} className="text-slate-500 text-lg max-w-lg mx-auto">
            We built Qlarity because scattered files, messy email approvals, and broken version control
            were slowing teams down. There's a better way.
          </motion.p>
        </motion.div>

        {/* Grid with scroll-driven spotlight beam */}
        <div className="relative">

          {/* Spotlight wash — broad amber bloom that sweeps left to right */}
          {!reduce && (
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none z-10 rounded-3xl"
              style={{ background: spotBg }}
            />
          )}

          {/* Scan line — the sharp leading edge of the beam */}
          {!reduce && (
            <motion.div
              aria-hidden="true"
              className="absolute top-0 bottom-0 w-px pointer-events-none z-20"
              style={{
                left: lineLeft,
                background: 'linear-gradient(to bottom, transparent 5%, rgba(245,158,11,0.55) 30%, rgba(255,180,0,0.8) 50%, rgba(245,158,11,0.55) 70%, transparent 95%)',
                boxShadow: '0 0 14px 5px rgba(245,158,11,0.18)',
              }}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PILLARS.map((p, i) => (
              <PillarCard key={p.title} p={p} index={i} smoothProgress={smoothProgress} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
