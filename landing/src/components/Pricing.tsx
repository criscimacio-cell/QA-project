import { motion } from 'framer-motion';
import { Mail, Shield, Users } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const ACCESS_ITEMS = [
  {
    icon: Users,
    title: 'Request Access',
    desc: 'Access to Qlarity is managed by your organization admin. Reach out to get your account set up.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    cta: 'Contact Admin',
    ctaHref: 'mailto:admin@stash.ph',
    highlight: true,
  },
  {
    icon: Shield,
    title: 'Role Assignment',
    desc: 'Your role determines what you can view, upload, and approve. Admins configure permissions per module.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    cta: null,
    ctaHref: null,
    highlight: false,
  },
  {
    icon: Mail,
    title: 'Need Help?',
    desc: 'Having trouble logging in or accessing a module? Reach out to the internal support team.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    cta: 'Get Support',
    ctaHref: 'mailto:support@stash.ph',
    highlight: false,
  },
];

export default function Pricing() {
  const { ref, isInView } = useScrollReveal(0.1);

  return (
    <section id="pricing" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/20 to-slate-950" />

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs font-medium text-violet-400 mb-4">
            Internal access
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gradient-white tracking-tight mb-4">
            Getting started
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Access is managed by your organization. Contact your admin to get set up.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
        >
          {ACCESS_ITEMS.map((item) => (
            <motion.div
              key={item.title}
              whileHover={{ y: item.highlight ? -8 : -4, transition: { duration: 0.3 } }}
              className={`relative rounded-2xl p-8 flex flex-col gap-6 ${
                item.highlight
                  ? 'amber-border-glow glow-amber bg-gradient-to-b from-amber-500/8 to-transparent'
                  : 'card-glass'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center`}>
                <item.icon size={18} className={item.color} />
              </div>
              <div>
                <h3 className={`text-lg font-semibold mb-2 ${item.highlight ? 'text-white' : 'text-slate-300'}`}>{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
              {item.cta && item.ctaHref && (
                <motion.a
                  href={item.ctaHref}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all duration-200 ${
                    item.highlight
                      ? 'bg-amber-500 hover:bg-amber-400 text-white glow-amber-sm'
                      : 'bg-white/8 hover:bg-white/14 border border-white/12 text-white'
                  }`}
                >
                  {item.cta}
                </motion.a>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
