import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  href?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
  strength?: number;
}

// Magnetic pull effect — cursor attracts the button toward it.
// Uses springs so motion has momentum and trails the cursor naturally.
// Safe per Emil's standards: decorative mouse-tracking = springs are correct here.
export function MagneticButton({ href, onClick, className, children, strength = 0.32 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 180, damping: 14, mass: 0.5 });
  const y = useSpring(rawY, { stiffness: 180, damping: 14, mass: 0.5 });

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    rawX.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    rawY.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  };

  const onMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <div ref={wrapRef} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} className="inline-block">
      {onClick ? (
        <motion.button
          onClick={onClick}
          style={{ x, y }}
          whileTap={{ transform: 'scale(0.97)' }}
          className={className}
        >
          {children}
        </motion.button>
      ) : (
        <motion.a
          href={href}
          style={{ x, y }}
          whileTap={{ transform: 'scale(0.97)' }}
          className={className}
        >
          {children}
        </motion.a>
      )}
    </div>
  );
}
