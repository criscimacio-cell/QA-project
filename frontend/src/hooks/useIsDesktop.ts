import { useEffect, useState } from 'react';

// Matches Tailwind's default `md` breakpoint, so `md:` utility classes and
// this hook agree on where desktop layout starts.
const QUERY = '(min-width: 768px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : true
  ));

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
