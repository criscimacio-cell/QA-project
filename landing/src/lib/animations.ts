import type { Variants } from 'framer-motion';

// Strong ease-out — cubic-bezier from easing.dev, punchy and responsive
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, transform: 'translateY(32px)' },
  show: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.6, ease: EASE_OUT } },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, transform: 'translateY(-24px)' },
  show: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.55, ease: EASE_OUT } },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, transform: 'translateX(-40px)' },
  show: { opacity: 1, transform: 'translateX(0px)', transition: { duration: 0.6, ease: EASE_OUT } },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, transform: 'translateX(40px)' },
  show: { opacity: 1, transform: 'translateX(0px)', transition: { duration: 0.6, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, transform: 'scale(0.94)' },
  show: { opacity: 1, transform: 'scale(1)', transition: { duration: 0.55, ease: EASE_OUT } },
};

export const stagger = (delay = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
});

// No filter: blur — it triggers paint on every frame and is expensive on Safari.
// opacity + translateY gives the same "material entering" feel for free.
export const blurUp: Variants = {
  hidden: { opacity: 0, transform: 'translateY(24px)' },
  show: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.65, ease: EASE_OUT } },
};

export const slideReveal: Variants = {
  hidden: { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
  show: { opacity: 1, clipPath: 'inset(0 0 0% 0)', transition: { duration: 0.7, ease: EASE_IN_OUT } },
};
