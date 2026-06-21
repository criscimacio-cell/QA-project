import { motion, useReducedMotion, useMotionValue, useSpring, useTransform, useScroll, MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { FolderOpen, GitPullRequest, Users, History, Lock, ShieldCheck, Search, Layers } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';

const FEATURES = [
  { icon: FolderOpen, title: 'Centralized Storage', desc: 'One secure home for every document across your organization — PDFs, Word files, spreadsheets, and more. Organized by folder, tag, and department.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', glow: 'rgba(245,158,11,0.12)', size: 'large', tags: ['Any File Type', 'Folder Structure', 'Department Views'] },
  { icon: GitPullRequest, title: 'Approval Workflows', desc: 'Route documents through customizable multi-step review chains. Set required approvers, deadlines, and automatic escalations.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', glow: 'rgba(59,130,246,0.12)', size: 'large', tags: ['Multi-step Reviews', 'Auto Escalation', 'Email Alerts'] },
  { icon: History, title: 'Version Control', desc: 'Every edit is tracked. Restore any previous version instantly with a full change history and side-by-side comparison.', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', glow: 'rgba(139,92,246,0.1)', size: 'small' },
  { icon: Users, title: 'Team Collaboration', desc: 'Comment, annotate, and tag teammates directly on documents. Resolve threads and keep discussions in context.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', glow: 'rgba(16,185,129,0.1)', size: 'small' },
  { icon: Lock, title: 'Granular Permissions', desc: 'Control exactly who can view, edit, share, or approve each document. Down to individual file level.', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', glow: 'rgba(239,68,68,0.1)', size: 'small' },
  { icon: ShieldCheck, title: 'Audit Trail', desc: 'Immutable log of every open, edit, share, and approval action — timestamped and exportable for compliance.', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', glow: 'rgba(6,182,212,0.1)', size: 'small' },
  { icon: Search, title: 'Full-Text Search', desc: 'Search inside document contents, not just filenames. Find what you need in seconds across thousands of files.', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', glow: 'rgba(234,179,8,0.1)', size: 'small' },
  { icon: Layers, title: 'Templates', desc: 'Build reusable document templates for contracts, reports, and forms. Standardize structure across your team.', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', glow: 'rgba(249,115,22,0.1)', size: 'small' },
];

// Each card's off-screen origin — positioned around a clock face
// so they orbit inward from different directions as you scroll
const ORBIT_ORIGINS = [
  { x: -700, y: -180, rz:  -4 }, // top-left
  { x:  120, y: -680, rz:   3 }, // top
  { x:  740, y: -120, rz:   4 }, // top-right
  { x:  860, y:  160, rz:  -3 }, // right
  { x:  520, y:  560, rz:   4 }, // bottom-right
  { x: -120, y:  700, rz:  -4 }, // bottom
  { x: -620, y:  420, rz:   3 }, // bottom-left
  { x: -860, y:   60, rz:  -3 }, // left
];

const large = FEATURES.filter((f) => f.size === 'large');
const small = FEATURES.filter((f) => f.size === 'small');

function BentoCard({
  f,
  big = false,
  index = 0,
  scrollYProgress,
}: {
  f: typeof FEATURES[number];
  big?: boolean;
  index?: number;
  scrollYProgress: MotionValue<number>;
}) {
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  // ── Scroll-driven orbit path ──────────────────────────────────────────────
  // Each card gets its own staggered window within the section's scroll range.
  // Cards arrive one-by-one, spiralling in from their origin point.
  const origin = ORBIT_ORIGINS[index % ORBIT_ORIGINS.length];
  const s0 = index * 0.1;            // when this card starts moving (wider stagger across scroll)
  const s1 = s0 + 0.28;             // when it lands in place

  const rawX     = useTransform(scrollYProgress, [s0, s1], [origin.x, 0]);
  const rawY     = useTransform(scrollYProgress, [s0, s1], [origin.y, 0]);
  const rawRZ    = useTransform(scrollYProgress, [s0, s1], [origin.rz, 0]);
  const rawScale = useTransform(scrollYProgress, [s0, s0 + 0.28], [0.55, 1]);
  const opacity  = useTransform(scrollYProgress, [s0, s0 + 0.14], [0, 1]);

  // Springs add momentum so the cards feel like they have physical weight
  const x     = useSpring(rawX,     { stiffness: 90, damping: 18, mass: 1 });
  const y     = useSpring(rawY,     { stiffness: 90, damping: 18, mass: 1 });
  const rz    = useSpring(rawRZ,    { stiffness: 90, damping: 18, mass: 1 });
  const scale = useSpring(rawScale, { stiffness: 90, damping: 18, mass: 1 });

  // ── 3D tilt on hover (separate rotateX/Y axes, stacks on top of orbit) ──
  const tiltRawX = useMotionValue(0);
  const tiltRawY = useMotionValue(0);
  const rotateX  = useSpring(useTransform(tiltRawY, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 20, mass: 0.6 });
  const rotateY  = useSpring(useTransform(tiltRawX, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 20, mass: 0.6 });

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    tiltRawX.set((e.clientX - rect.left) / rect.width - 0.5);
    tiltRawY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onMouseLeave = () => {
    tiltRawX.set(0);
    tiltRawY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={reduce ? {} : {
        x, y,
        rotateZ: rz,
        scale,
        opacity,
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        transformPerspective: 900,
      }}
      className="bento-card rounded-2xl p-7 flex flex-col gap-5 cursor-default group relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(300px circle at 35% 40%, ${f.glow}, transparent 70%)` }}
      />

      <div
        className={`relative z-10 ${big ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl ${f.bg} border ${f.border} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}
        style={reduce ? {} : { transform: 'translateZ(16px)' }}
      >
        <f.icon size={big ? 22 : 18} className={f.color} />
      </div>

      <div className="relative z-10" style={reduce ? {} : { transform: 'translateZ(8px)' }}>
        <h3 className={`font-semibold text-slate-800 mb-2 ${big ? 'text-base' : 'text-sm'}`}>{f.title}</h3>
        <p className="text-slate-500 leading-relaxed text-sm">{f.desc}</p>
      </div>

      {big && f.tags && (
        <div className="relative z-10 mt-auto pt-2 flex flex-wrap gap-2" style={reduce ? {} : { transform: 'translateZ(4px)' }}>
          {f.tags.map((tag) => (
            <span key={tag} className={`text-xs px-2.5 py-1 rounded-full ${f.bg} border ${f.border} ${f.color} font-medium`}>{tag}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);

  // Scroll range: cards start animating when section enters 85% of viewport,
  // finish landing by the time section center hits 35% from top.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 1.0', 'end 0.5'],
  });

  return (
    <section
      ref={sectionRef}
      id="features"
      aria-labelledby="features-heading"
      className="py-32 relative overflow-visible scroll-mt-20"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-white/60 to-[#FAFAFA]" />

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center mb-16"
        >
          <motion.div variants={blurUp}
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 mb-4">
            Everything you need
          </motion.div>
          <motion.h2
            id="features-heading"
            variants={blurUp}
            className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4"
          >
            Built for document-driven teams
          </motion.h2>
          <motion.p variants={blurUp} className="text-slate-500 text-lg max-w-xl mx-auto">
            Every feature works together seamlessly — from upload to approval to publish, with full traceability.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {large.map((f, i) => (
              <BentoCard key={f.title} f={f} big index={i} scrollYProgress={scrollYProgress} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {small.slice(0, 2).map((f, i) => (
              <BentoCard key={f.title} f={f} index={large.length + i} scrollYProgress={scrollYProgress} />
            ))}
          </div>
          {small.slice(2).map((f, i) => (
            <BentoCard key={f.title} f={f} index={large.length + 2 + i} scrollYProgress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}
