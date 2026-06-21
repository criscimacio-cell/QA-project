import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';

const STATS = [
  { value: '10,000+', label: 'Assets managed' },
  { value: '500+', label: 'QA teams' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '< 200ms', label: 'Avg response time' },
];

const TESTIMONIALS = [
  {
    quote: "Qlarity cut our approval turnaround time in half. Everything is in one place now — no more Slack threads hunting for the latest test data file.",
    name: 'Sarah K.',
    role: 'QA Lead, Fintech startup',
    avatar: 'SK',
    color: 'bg-amber-500',
  },
  {
    quote: "The RBAC system is exactly what we needed. I can give contractors access to specific modules without worrying about them seeing things they shouldn't.",
    name: 'Marcus T.',
    role: 'Engineering Manager',
    avatar: 'MT',
    color: 'bg-blue-500',
  },
  {
    quote: "Audit logs alone saved us during our last compliance review. Every action, timestamped, attributed. The auditors were impressed.",
    name: 'Priya N.',
    role: 'QA Director',
    avatar: 'PN',
    color: 'bg-violet-500',
  },
];

export default function SocialProof() {
  const { ref, isInView } = useScrollReveal(0.1);

  return (
    <section className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        {/* Stats */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-24"
        >
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="text-center"
            >
              <div className="text-3xl sm:text-4xl font-bold text-gradient mb-1">{s.value}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gradient-white tracking-tight">
            Loved by QA teams
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.3 } }}
              className="card-glass rounded-2xl p-6 flex flex-col gap-4 cursor-default"
            >
              <p className="text-sm text-slate-400 leading-relaxed flex-1">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
