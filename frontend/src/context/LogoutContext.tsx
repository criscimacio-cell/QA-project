import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/* ─── Context ──────────────────────────────────────────────────── */
interface LogoutCtx { triggerLogout: () => void; }
const LogoutContext = createContext<LogoutCtx>({ triggerLogout: () => {} });
export const useLogout = () => useContext(LogoutContext);

/* ─── Overlay component ────────────────────────────────────────── */
function LogoutOverlay({
  visible, shrunk, ringPulse, fading,
}: {
  visible: boolean; shrunk: boolean; ringPulse: boolean; fading: boolean;
}) {
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes ringOut {
            0%   { opacity: 0.7; transform: translate(-50%,-50%) scale(1); }
            100% { opacity: 0;   transform: translate(-50%,-50%) scale(2.4); }
          }
        }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10,
        background: '#e8f4f8',
        opacity: fading ? 0 : visible ? 1 : 0,
        transition: fading ? 'opacity 0.3s ease' : 'opacity 0.4s ease',
        pointerEvents: 'none',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>

          {/* Ring 1 */}
          {ringPulse && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 80, height: 80, borderRadius: 22,
              border: '2px solid rgba(8,164,156,0.5)',
              animation: 'ringOut 0.55s ease-out forwards',
              pointerEvents: 'none',
            }} />
          )}
          {/* Ring 2 */}
          {ringPulse && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 80, height: 80, borderRadius: 22,
              border: '1.5px solid rgba(8,164,156,0.25)',
              animation: 'ringOut 0.55s ease-out 0.18s forwards',
              pointerEvents: 'none',
            }} />
          )}

          {/* Icon */}
          <div style={{
            width: shrunk ? 28 : 80,
            height: shrunk ? 28 : 80,
            borderRadius: shrunk ? 6 : 22,
            background: 'linear-gradient(135deg,#08a49c,#06b6d4)',
            boxShadow: shrunk ? 'none' : '0 8px 32px rgba(8,164,156,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: [
              'width 0.5s cubic-bezier(0.4,0,0.2,1)',
              'height 0.5s cubic-bezier(0.4,0,0.2,1)',
              'border-radius 0.5s ease',
              'box-shadow 0.5s ease',
            ].join(','),
          }}>
            <svg
              width={shrunk ? 14 : 42} height={shrunk ? 14 : 42}
              viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1), height 0.5s cubic-bezier(0.4,0,0.2,1)' }}>
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>

          {/* Wordmark */}
          <div style={{
            opacity: shrunk ? 0 : 1,
            transform: shrunk ? 'translateY(-6px)' : 'translateY(0)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
          }}>
            <span style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 500, fontSize: 20, color: '#0d2e2b', letterSpacing: '0.08em',
            }}>Q-KTAMP</span>
          </div>

          {/* Subtitle */}
          <div style={{
            opacity: shrunk ? 0 : 1,
            transform: shrunk ? 'translateY(-6px)' : 'translateY(0)',
            transition: 'opacity 0.3s ease 0.05s, transform 0.3s ease 0.05s',
            marginTop: -4,
          }}>
            <span style={{ fontSize: 11, color: '#5a8a86' }}>Session ended. See you soon 👋</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Provider ─────────────────────────────────────────────────── */
export function LogoutProvider({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [active, setActive]       = useState(false);
  const [visible, setVisible]     = useState(false);
  const [ringPulse, setRingPulse] = useState(false);
  const [shrunk, setShrunk]       = useState(false);
  const [fading, setFading]       = useState(false);

  const triggerLogout = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      logout();
      navigate('/login');
      return;
    }
    setActive(true);
  };

  useEffect(() => {
    if (!active) return;
    const ts: ReturnType<typeof setTimeout>[] = [];

    // 0ms: overlay mounts (opacity 0) → triggers 0.4s fade-in
    ts.push(setTimeout(() => setVisible(true), 10));

    // 500ms: rings pulse
    ts.push(setTimeout(() => setRingPulse(true), 500));

    // 900ms: icon shrinks + text fades
    ts.push(setTimeout(() => setShrunk(true), 900));

    // 1400ms: overlay fades out (0.3s → gone at 1700ms)
    ts.push(setTimeout(() => setFading(true), 1400));

    // 1700ms: clear auth + navigate → login page mounts and fades in
    ts.push(setTimeout(() => {
      logout();
      navigate('/login');
      // Tear down overlay after it's invisible
      setTimeout(() => {
        setActive(false);
        setVisible(false);
        setRingPulse(false);
        setShrunk(false);
        setFading(false);
      }, 50);
    }, 1700));

    return () => ts.forEach(clearTimeout);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LogoutContext.Provider value={{ triggerLogout }}>
      {children}
      {active && (
        <LogoutOverlay
          visible={visible}
          ringPulse={ringPulse}
          shrunk={shrunk}
          fading={fading}
        />
      )}
    </LogoutContext.Provider>
  );
}
