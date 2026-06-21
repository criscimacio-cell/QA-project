import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';

export default function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(245,158,11,0.1) 0%, transparent 70%)',
        }}
      />

      {/* Animated ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none">
        <div className="ring-pulse absolute inset-0 rounded-full border border-amber-500/20" />
        <div className="ring-pulse absolute inset-12 rounded-full border border-amber-500/10" style={{ animationDelay: '1s' }} />
        <div className="ring-pulse absolute inset-24 rounded-full border border-amber-500/15" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-6"
        >
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-xs font-medium text-amber-400">
            <Zap size={12} className="fill-amber-400" />
            Free forever for small teams
          </div>

          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="text-gradient-white">Ready to organize</span>
            <br />
            <span className="text-gradient">your QA assets?</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-lg">
            Join hundreds of QA teams already using Qlarity. Free to start, scales with you.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <motion.a
              href="/register"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="shimmer-btn inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors glow-amber"
            >
              Get Started Free
              <ArrowRight size={16} />
            </motion.a>
            <motion.a
              href="mailto:hello@qlarity.io"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/12 text-white font-medium px-8 py-3.5 rounded-xl text-sm transition-all"
            >
              Talk to Sales
            </motion.a>
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap justify-center gap-6 pt-2">
            {['No credit card', 'Free forever for small teams', 'Cancel anytime'].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-1 h-1 rounded-full bg-amber-400/60 inline-block" />
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
