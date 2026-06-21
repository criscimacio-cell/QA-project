import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import { Layers, Menu, X } from 'lucide-react';

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 30));

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-slate-950/85 backdrop-blur-2xl shadow-xl shadow-black/30'
          : 'bg-transparent'
      }`}
    >
      {/* Scrolled border with gradient */}
      {scrolled && (
        <div
          className="absolute bottom-0 inset-x-0 h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.3), rgba(139,92,246,0.2), transparent)' }}
        />
      )}

      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ duration: 0.3 }}
            className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center group-hover:bg-amber-500/30 group-hover:border-amber-500/60 transition-colors duration-300"
          >
            <Layers size={16} className="text-amber-400" />
          </motion.div>
          <span className="font-bold text-white tracking-tight">Qlarity</span>
          <span className="text-xs text-amber-400/80 font-medium hidden sm:inline px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            Asset Platform
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-all duration-200 group"
            >
              {l.label}
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-px bg-amber-400/60 group-hover:w-4 transition-all duration-300" />
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/login"
            className="text-sm text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2"
          >
            Log in
          </a>
          <motion.a
            href="/register"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="shimmer-btn text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/25"
          >
            Get Started
          </motion.a>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-slate-400 hover:text-white transition-colors p-2"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden md:hidden border-t border-white/8 bg-slate-950/95 backdrop-blur-2xl"
      >
        <div className="px-6 py-4 flex flex-col gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="px-4 py-3 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/6 transition-all"
            >
              {l.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <a href="/login" className="text-sm text-slate-400 hover:text-white text-center py-2">Log in</a>
            <a href="/register" className="text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white py-2.5 rounded-lg text-center transition-all">
              Get Started
            </a>
          </div>
        </div>
      </motion.div>
    </motion.nav>
  );
}
