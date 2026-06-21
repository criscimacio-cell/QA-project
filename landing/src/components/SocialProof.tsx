import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { FileCheck, ShieldCheck, Zap, Users } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';

const PILLARS = [
  { icon: FileCheck, title: 'Built for documents', desc: 'Every feature is designed around how real teams handle files — not bolted on after the fact.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { icon: ShieldCheck, title: 'Security first', desc: 'Role-based access, audit trails, and version history mean you always know who did what, when.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { icon: Zap, title: 'Fast to set up', desc: 'No lengthy onboarding. Import your files, invite your team, and start reviewing documents on day one.', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { icon: Users, title: 'Made for teams', desc: 'From solo founders to large departments — Qlarity grows with you without adding unnecessary complexity.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
];

export default function SocialProof() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [-20, 20]);

  return (
    <section id="why-qlarity" aria-labelledby="why-qlarity-heading" ref={ref} className="py-32 relative overflow-hidden bg-white">
      <motion.div style={{ y: bgY }} aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }}
        />
      </motion.div>

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

        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {PILLARS.map((p) => (
            <motion.div
              key={p.title}
              variants={blurUp}
              whileHover={{ transform: 'translateY(-5px)', transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
              className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow cursor-default group h-full"
            >
              <div className={`w-10 h-10 rounded-xl ${p.bg} border ${p.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                <p.icon size={18} className={p.color} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-800 mb-1.5">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
