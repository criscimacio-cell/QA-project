import { motion, useScroll, useTransform, useSpring, useReducedMotion, MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { FileCheck, ShieldCheck, Zap, Users } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';

const PILLARS = [
  { icon: FileCheck, title: 'Built for documents', desc: 'Every feature is designed around how real teams handle files — not bolted on after the fact.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', glow: 'rgba(245,158,11,0.08)' },
  { icon: ShieldCheck, title: 'Security first', desc: 'Role-based access, audit trails, and version history mean you always know who did what, when.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', glow: 'rgba(59,130,246,0.08)' },
  { icon: Zap, title: 'Fast to set up', desc: 'No lengthy onboarding. Import your files, invite your team, and start reviewing documents on day one.', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', glow: 'rgba(139,92,246,0.08)' },
  { icon: Users, title: 'Made for teams', desc: 'From solo founders to large departments — Qlarity grows with you without adding unnecessary complexity.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', glow: 'rgba(16,185,129,0.08)' },
];

// Where each card starts (stacked in center) vs where it lands (spread across grid).
// x is expressed as a fraction of the card's own width so it works at any screen size.
// Cards stack with slight rotateY and z-offset to look like a physical deck.
const STACK_CONFIG = [
  { startX: '0%',   startRY:  18, startRZ: -3, startZ:  0,  delay: 0    }, // card 0 — far left, spreads leftward
  { startX: '0%',   startRY:   8, startRZ: -1, startZ: 10,  delay: 0.06 }, // card 1
  { startX: '0%',   startRY:  -8, startRZ:  1, startZ: 20,  delay: 0.12 }, // card 2
  { startX: '0%',   startRY: -18, startRZ:  3, startZ: 30,  delay: 0.18 }, // card 3 — far right, spreads rightward
];

// Final x offsets as multiples of (card width + gap) relative to stacked center
// On a 4-col grid the cards need to travel: -1.5, -0.5, +0.5, +1.5 column widths
const LAND_X = ['-162%', '-54%', '54%', '162%'];

function PillarCard({
  p,
  index,
  scrollProgress,
}: {
  p: typeof PILLARS[number];
  index: number;
  scrollProgress: MotionValue<number>;
}) {
  const reduce = useReducedMotion();
  const cfg = STACK_CONFIG[index];

  // Stagger each card's window slightly so they unspool one after another
  const s0 = cfg.delay;
  const s1 = s0 + 0.55;

  const rawX  = useTransform(scrollProgress, [s0, s1], ['0%', LAND_X[index]]);
  const rawRY = useTransform(scrollProgress, [s0, s1], [cfg.startRY, 0]);
  const rawRZ = useTransform(scrollProgress, [s0, s1], [cfg.startRZ, 0]);
  const rawZ  = useTransform(scrollProgress, [s0, Math.min(s0 + 0.2, s1)], [cfg.startZ, 0]);
  const opacity = useTransform(scrollProgress, [s0, s0 + 0.2], [0, 1]);
  const scale   = useTransform(scrollProgress, [s0, s1], [0.88, 1]);

  const x  = useSpring(rawX,  { stiffness: 80, damping: 18, mass: 1.1 });
  const ry = useSpring(rawRY, { stiffness: 80, damping: 18, mass: 1.1 });
  const rz = useSpring(rawRZ, { stiffness: 80, damping: 18, mass: 1.1 });
  const z  = useSpring(rawZ,  { stiffness: 80, damping: 18, mass: 1.1 });
  const sc = useSpring(scale, { stiffness: 80, damping: 18, mass: 1.1 });

  return (
    <motion.div
      style={reduce ? {} : {
        x, z,
        rotateY: ry,
        rotateZ: rz,
        scale: sc,
        opacity,
        transformStyle: 'preserve-3d',
        transformPerspective: 1200,
        position: 'relative',
        zIndex: index,
      }}
      whileHover={reduce ? {} : { rotateY: 0, rotateZ: 0, transition: { duration: 0.2 } }}
      className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-lg transition-shadow cursor-default group h-full relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(180px circle at 30% 40%, ${p.glow}, transparent 70%)` }}
      />
      <div className={`relative z-10 w-10 h-10 rounded-xl ${p.bg} border ${p.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
        <p.icon size={18} className={p.color} />
      </div>
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
    offset: ['start 0.8', 'center 0.35'],
  });

  const scrollProgress = useSpring(scrollYProgress, { stiffness: 55, damping: 16, mass: 1.2 });

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

        {/* Cards start stacked in center; perspective wrapper enables the 3D */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          style={reduce ? {} : { perspective: '1200px' }}
        >
          {PILLARS.map((p, i) => (
            <PillarCard key={p.title} p={p} index={i} scrollProgress={scrollProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}
