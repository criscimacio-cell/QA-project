import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { stagger, fadeUp } from '../lib/animations';

const LINKS: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Changelog', href: '/changelog' },
    { label: 'Roadmap', href: '/roadmap' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'Status', href: '/status' },
    { label: 'Security', href: '/security' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: 'mailto:hello@qlarity.io' },
  ],
};

export default function Footer() {
  return (
    <footer aria-label="Site footer" className="border-t border-slate-200 bg-white pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-16"
        >
          {/* Brand */}
          <motion.div variants={fadeUp} className="col-span-2 sm:col-span-1">
            <a href="/" aria-label="Qlarity — home" className="flex items-center gap-2.5 mb-4 w-fit">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Layers size={16} className="text-amber-500" />
              </div>
              <span className="font-bold text-slate-900">Qlarity</span>
            </a>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[180px]">
              Modern document management for teams that care about control.
            </p>
          </motion.div>

          {Object.entries(LINKS).map(([section, items]) => (
            <motion.div key={section} variants={fadeUp}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{section}</h3>
              <nav aria-label={`${section} links`}>
                <ul className="flex flex-col gap-2">
                  {items.map((item, i) => (
                    <motion.li
                      key={item.label}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + i * 0.05, duration: 0.35 }}
                    >
                      <a href={item.href} className="text-sm text-slate-500 hover:text-slate-900 transition-colors duration-200">
                        {item.label}
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </nav>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-100"
        >
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Qlarity. All rights reserved.</p>
          <div className="flex items-center gap-4">
            {[
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Cookies', href: '/cookies' },
            ].map((l) => (
              <a key={l.label} href={l.href} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">{l.label}</a>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
