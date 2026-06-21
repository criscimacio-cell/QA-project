import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import { blurUp, fadeUp, stagger } from '../lib/animations';

export default function CTA() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const ringScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 1.05]);
  const bgY = useTransform(scrollYProgress, [0, 1], [-15, 15]);

  return (
    <section ref={ref} className="py-24 relative overflow-hidden bg-white">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(245,158,11,0.07) 0%, transparent 70%)' }} />
      </motion.div>

      <motion.div style={{ scale: ringScale }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none">
        <div className="ring-pulse absolute inset-0 rounded-full border border-amber-300/40" />
        <div className="ring-pulse absolute inset-12 rounded-full border border-amber-200/30" style={{ animationDelay: '1s' }} />
        <div className="ring-pulse absolute inset-24 rounded-full border border-amber-300/35" style={{ animationDelay: '2s' }} />
      </motion.div>

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.div variants={stagger(0.09)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} className="flex flex-col items-center gap-6">
          <motion.div variants={blurUp} className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700">
            <Zap size={12} className="fill-amber-500 text-amber-500" />
            Free forever for small teams
          </motion.div>

          <motion.h2 variants={blurUp} className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="text-slate-900">Stop managing documents</span>
            <br />
            <span className="text-gradient">in the wrong place.</span>
          </motion.h2>

          <motion.p variants={fadeUp} className="text-slate-500 text-lg max-w-lg">
            Be among the first to bring real order to your documents — one place to store, review, and publish everything your team works on.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3 justify-center">
            <motion.a href="/register" whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.96 }}
              className="shimmer-btn inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-amber-200">
              Get Started Free <ArrowRight size={16} />
            </motion.a>
            <motion.a href="mailto:hello@qlarity.io" whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium px-8 py-3.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md">
              Talk to Sales
            </motion.a>
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-6 pt-2">
            {['No credit card', 'Free forever for small teams', 'Cancel anytime'].map((item, i) => (
              <motion.span key={item} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />
                {item}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
