import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  { email: 'admin@qa.com',     role: 'Admin',    color: '#ef4444' },
  { email: 'lead@qa.com',      role: 'Lead',     color: '#F59E0B' },
  { email: 'engineer1@qa.com', role: 'Engineer', color: '#3b82f6' },
  { email: 'viewer@qa.com',    role: 'Viewer',   color: '#64748b' },
];

/* ─── Post-login morph overlay ─────────────────────────────────────── */
function MorphOverlay({ grown, ringPulse, fadingOut }: { grown: boolean; ringPulse: boolean; fadingOut: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAFA',
      opacity: fadingOut ? 0 : 1,
      transition: fadingOut ? 'opacity 0.45s ease' : 'none',
      pointerEvents: fadingOut ? 'none' : 'all',
    }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {ringPulse && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 80, height: 80, borderRadius: 22, transform: 'translate(-50%,-50%)', border: '2px solid rgba(245,158,11,0.5)', animation: 'ringExpand 0.55s ease-out forwards', pointerEvents: 'none' }} />
        )}
        {ringPulse && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 80, height: 80, borderRadius: 22, transform: 'translate(-50%,-50%)', border: '1.5px solid rgba(245,158,11,0.25)', animation: 'ringExpand 0.55s ease-out 0.18s forwards', pointerEvents: 'none' }} />
        )}
        <div style={{ width: grown ? 80 : 40, height: grown ? 80 : 40, borderRadius: grown ? 22 : 10, background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', boxShadow: '0 8px 32px rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 0.5s cubic-bezier(0.34,1.3,0.64,1),height 0.5s cubic-bezier(0.34,1.3,0.64,1),border-radius 0.5s cubic-bezier(0.34,1.3,0.64,1)' }}>
          <svg width={grown ? 34 : 18} height={grown ? 34 : 18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'width 0.5s cubic-bezier(0.34,1.3,0.64,1),height 0.5s cubic-bezier(0.34,1.3,0.64,1)' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <div style={{ overflow: 'hidden', opacity: grown ? 1 : 0, maxHeight: grown ? 40 : 0, transition: 'opacity 0.35s ease 0.3s,max-height 0.35s ease 0.3s' }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '0.04em' }}>Qlarity</span>
        </div>
        <div style={{ opacity: grown ? 1 : 0, transform: grown ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease 0.55s,transform 0.3s ease 0.55s', marginTop: -10 }}>
          <span style={{ fontSize: 11, color: '#5a8a86', letterSpacing: '0.04em' }}>Loading your workspace…</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ANIMATION LAYER COMPONENTS
══════════════════════════════════════════════════════════════════════ */

/* 1 ── Breathing dot grid */
function BreathingGrid() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.065) 1px, transparent 1px)',
      backgroundSize: '44px 44px',
      animation: 'gridPulse 5s ease-in-out infinite',
    }} />
  );
}

/* 2 ── Aurora bands */
function AuroraLayer() {
  return (
    <>
      {[
        { top: '10%', h: 160, dur: '14s', del: '0s',   grad: 'rgba(245,158,11,0.07) 25%, rgba(139,92,246,0.07) 55%, rgba(20,184,166,0.05) 80%' },
        { top: '42%', h: 130, dur: '19s', del: '-6s',  grad: 'rgba(20,184,166,0.05) 20%, rgba(245,158,11,0.08) 60%, rgba(139,92,246,0.05) 85%' },
        { top: '70%', h: 150, dur: '24s', del: '-12s', grad: 'rgba(139,92,246,0.06) 15%, rgba(20,184,166,0.05) 55%, rgba(245,158,11,0.07) 90%' },
      ].map((b, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          height: b.h, top: b.top,
          background: `linear-gradient(90deg, transparent 0%, ${b.grad}, transparent 100%)`,
          filter: 'blur(22px)',
          animation: `auroraDrift ${b.dur} ease-in-out ${b.del} infinite`,
          pointerEvents: 'none',
        }} />
      ))}
    </>
  );
}

/* 3 ── Morphing blobs */
function MorphingBlob() {
  return (
    <>
      <div style={{ position:'absolute', width:420, height:420, top:'18%', left:'20%', background:'radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 70%)', animation:'blobMorph 11s ease-in-out infinite', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:360, height:360, top:'48%', left:'58%', background:'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)', animation:'blobMorph 15s ease-in-out -5s infinite reverse', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:300, height:300, top:'68%', left:'8%',  background:'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)', animation:'blobMorph 9s ease-in-out -3s infinite', pointerEvents:'none' }} />
    </>
  );
}

/* 4 ── Meteor streaks */
function MeteorLayer() {
  const [meteors, setMeteors] = useState<Array<{ id: number; top: number; left: number }>>([]);
  useEffect(() => {
    let n = 0;
    const spawn = () => setMeteors(prev => [...prev.slice(-10), { id: n++, top: Math.random() * 75, left: Math.random() * 80 }]);
    const id = setInterval(spawn, 1400);
    spawn();
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:2 }}>
      {meteors.map(m => (
        <div key={m.id} className="meteor" style={{ top:`${m.top}%`, left:`${m.left}%` }} />
      ))}
    </div>
  );
}

/* 5 ── Dust motes */
function DustMotes() {
  const motes = Array.from({ length: 38 }, (_, i) => ({
    id: i,
    left: (i * 2.7 + Math.sin(i * 1.4) * 6) % 97,
    delay: -(i * 0.38) % 14,
    dur: 9 + (i * 0.55) % 9,
    size: 1 + (i % 2),
    opacity: 0.18 + (i % 6) * 0.05,
  }));
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:2 }}>
      {motes.map(m => (
        <div key={m.id} className="dust-mote" style={{
          left: `${m.left}%`, bottom: '-4px',
          width: m.size, height: m.size,
          opacity: m.opacity,
          animationDuration: `${m.dur}s`,
          animationDelay: `${m.delay}s`,
        }} />
      ))}
    </div>
  );
}

/* 6 ── Constellation lines */
const STARS = [
  [115,45],[461,108],[835,162],[1123,72],[58,225],[720,288],[1267,342],
  [288,405],[936,468],[547,540],[1325,612],[202,666],[1037,720],[403,792],
  [691,837],[749,27],[1382,432],[605,198],[1181,585],[864,810],
];
const CONST_LINES = (() => {
  const lines: { x1:number;y1:number;x2:number;y2:number;del:string }[] = [];
  let idx = 0;
  for (let i = 0; i < STARS.length; i++) {
    for (let j = i + 1; j < STARS.length; j++) {
      const d = Math.hypot(STARS[i][0]-STARS[j][0], STARS[i][1]-STARS[j][1]);
      if (d < 380) lines.push({ x1:STARS[i][0], y1:STARS[i][1], x2:STARS[j][0], y2:STARS[j][1], del:`${-(idx++*0.35)%7}s` });
    }
  }
  return lines;
})();
function ConstellationLayer() {
  return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:1 }}
      viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      {CONST_LINES.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"
          style={{ animation: `constellate 5s ease-in-out ${l.del} infinite` }} />
      ))}
    </svg>
  );
}

/* 7 ── Cascading triangles */
function CascadingTriangles() {
  const tris = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: (i * 4.3 + Math.sin(i * 1.2) * 5) % 94,
    delay: -(i * 0.55) % 10,
    dur: 7 + (i * 0.32) % 6,
    size: 7 + (i % 4) * 4,
    amber: i % 3 === 0,
  }));
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:2 }}>
      {tris.map(t => (
        <div key={t.id} style={{
          position: 'absolute', left: `${t.left}%`, top: '-24px',
          width: 0, height: 0,
          borderLeft: `${t.size/2}px solid transparent`,
          borderRight: `${t.size/2}px solid transparent`,
          borderBottom: `${t.size}px solid ${t.amber ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'}`,
          animation: `fall ${t.dur}s linear ${t.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* 8+9 ── Cursor-reactive shapes: repel + magnetic */
function CursorReactiveShapes({ mouseRef }: { mouseRef: React.MutableRefObject<{ x: number; y: number }> }) {
  const repelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const magnetRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      const { x: mx, y: my } = mouseRef.current;

      repelRefs.current.forEach(el => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = cx - mx, dy = cy - my;
        const dist = Math.hypot(dx, dy);
        const R = 190;
        if (dist < R && dist > 1) {
          const f = Math.pow((R - dist) / R, 1.6) * 60;
          el.style.transform = `translate(${dx/dist*f}px,${dy/dist*f}px)`;
          el.style.transition = 'transform 0.08s ease-out';
        } else {
          el.style.transform = 'translate(0,0)';
          el.style.transition = 'transform 0.7s ease-out';
        }
      });

      magnetRefs.current.forEach(el => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = mx - cx, dy = my - cy;
        const dist = Math.hypot(dx, dy);
        const R = 260;
        if (dist < R && dist > 1) {
          const f = Math.pow((R - dist) / R, 2) * 38;
          el.style.transform = `translate(${dx/dist*f}px,${dy/dist*f}px)`;
          el.style.transition = 'transform 0.15s ease-out';
        } else {
          el.style.transform = 'translate(0,0)';
          el.style.transition = 'transform 0.8s ease-out';
        }
      });

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mouseRef]);

  const repel = [
    { top:'22%', left:'30%', s:52, color:'rgba(245,158,11,0.13)', br:'50%' },
    { top:'54%', left:'16%', s:38, color:'rgba(255,255,255,0.10)', br:'50%' },
    { top:'36%', left:'62%', s:46, color:'rgba(245,158,11,0.11)', br:'10px' },
    { top:'70%', left:'46%', s:34, color:'rgba(255,255,255,0.08)', br:'50%' },
    { top:'14%', left:'72%', s:44, color:'rgba(245,158,11,0.12)', br:'50%' },
    { top:'82%', left:'64%', s:30, color:'rgba(255,255,255,0.08)', br:'10px' },
    { top:'48%', left:'3%',  s:40, color:'rgba(139,92,246,0.1)',   br:'50%' },
  ];
  const magnet = [
    { top:'28%', left:'6%',  s:72, color:'rgba(245,158,11,0.10)', br:'50%' },
    { top:'58%', left:'70%', s:88, color:'rgba(139,92,246,0.08)', br:'50%' },
    { top:'8%',  left:'42%', s:62, color:'rgba(255,255,255,0.07)', br:'50%' },
    { top:'76%', left:'28%', s:58, color:'rgba(245,158,11,0.09)', br:'50%' },
    { top:'40%', left:'90%', s:50, color:'rgba(20,184,166,0.08)', br:'50%' },
  ];

  return (
    <>
      {repel.map((s, i) => (
        <div key={`rp${i}`} ref={el => { repelRefs.current[i] = el; }} style={{ position:'absolute', top:s.top, left:s.left, width:s.s, height:s.s, borderRadius:s.br, background:s.color, filter:'blur(5px)', pointerEvents:'none', willChange:'transform' }} />
      ))}
      {magnet.map((s, i) => (
        <div key={`mg${i}`} ref={el => { magnetRefs.current[i] = el; }} style={{ position:'absolute', top:s.top, left:s.left, width:s.s, height:s.s, borderRadius:s.br, background:s.color, filter:'blur(7px)', pointerEvents:'none', willChange:'transform' }} />
      ))}
    </>
  );
}

/* 10 ── Particle trail canvas */
function ParticleTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    type P = { x: number; y: number; a: number; size: number; vx: number; vy: number };
    const pts: P[] = [];
    let raf: number;
    let lx = -1, ly = -1;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      if (lx !== -1) {
        const steps = Math.ceil(Math.hypot(e.clientX - lx, e.clientY - ly) / 10);
        for (let s = 0; s < steps && pts.length < 100; s++) {
          const t = s / steps;
          pts.push({ x: lx+(e.clientX-lx)*t, y: ly+(e.clientY-ly)*t, a: 0.55, size: 2.5+Math.random()*1.5, vx:(Math.random()-.5)*.4, vy:(Math.random()-.5)*.4-.25 });
        }
      }
      lx = e.clientX; ly = e.clientY;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        p.a -= 0.016; p.size *= 0.985;
        if (p.a <= 0) { pts.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(p.size * p.a, 0.3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,158,11,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvasRef} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:50 }} />;
}

/* ─── Reusable hook: wire eye-tracking to an injected cow SVG ─────────── */
function useCowEyes(
  containerRef: React.RefObject<HTMLDivElement>,
  mouseRef: React.MutableRefObject<{ x: number; y: number }>,
  maxPx: number,
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const wire = () => {
      const svg = el.querySelector('svg');
      if (!svg) return;
      const leftPupil   = svg.querySelector('#cow-pupil-left')   as SVGElement | null;
      const rightPupil  = svg.querySelector('#cow-pupil-right')  as SVGElement | null;
      const leftSocket  = svg.querySelector('#eye-socket-left')  as SVGElement | null;
      const rightSocket = svg.querySelector('#eye-socket-right') as SVGElement | null;
      if (!leftPupil || !rightPupil || !leftSocket || !rightSocket) return;

      leftPupil.style.transition  = 'transform 0.05s ease-out';
      rightPupil.style.transition = 'transform 0.05s ease-out';

      const onMove = () => {
        const mx = mouseRef.current.x, my = mouseRef.current.y;
        [{ pupil: leftPupil, socket: leftSocket }, { pupil: rightPupil, socket: rightSocket }]
          .forEach(({ pupil, socket }) => {
            const r = socket.getBoundingClientRect();
            const scx = r.left + r.width / 2, scy = r.top + r.height / 2;
            const dx = mx - scx, dy = my - scy;
            const dist = Math.hypot(dx, dy);
            const ox = dist > 0 ? (dx / dist) * Math.min(dist / 12, maxPx) : 0;
            const oy = dist > 0 ? (dy / dist) * Math.min(dist / 12, maxPx) : 0;
            pupil.style.transform = `translate(${ox}px, ${oy}px)`;
          });
      };
      document.addEventListener('mousemove', onMove);
      (el as any).__cowCleanup = () => document.removeEventListener('mousemove', onMove);
    };

    /* SVG might already be injected (baby cow), or needs fetching */
    if (el.querySelector('svg')) { wire(); return; }
    const id = setInterval(() => { if (el.querySelector('svg')) { clearInterval(id); wire(); } }, 50);
    return () => {
      clearInterval(id);
      const cleanup = (el as any).__cowCleanup;
      if (cleanup) cleanup();
    };
  }, [containerRef, mouseRef, maxPx]);
}

/* ─── Cow mascot: mama + baby ────────────────────────────────────────── */
function CowMascot({ mouseRef }: { mouseRef: React.MutableRefObject<{ x: number; y: number }> }) {
  const mamaRef = useRef<HTMLDivElement>(null);
  const babyRef = useRef<HTMLDivElement>(null);

  /* Fetch and inject SVG for mama cow */
  useEffect(() => {
    const el = mamaRef.current;
    if (!el) return;
    fetch('/the-cow-svgrepo-com.svg')
      .then(r => r.text())
      .then(svgText => {
        el.innerHTML = svgText;
        const svg = el.querySelector('svg');
        if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; svg.style.overflow = 'visible'; }
      })
      .catch(() => {});
    return () => { const c = (el as any).__cowCleanup; if (c) c(); };
  }, []);

  /* Fetch and inject SVG for baby cow */
  useEffect(() => {
    const el = babyRef.current;
    if (!el) return;
    fetch('/the-cow-svgrepo-com.svg')
      .then(r => r.text())
      .then(svgText => {
        el.innerHTML = svgText;
        const svg = el.querySelector('svg');
        if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; svg.style.overflow = 'visible'; }
      })
      .catch(() => {});
    return () => { const c = (el as any).__cowCleanup; if (c) c(); };
  }, []);

  useCowEyes(mamaRef, mouseRef, 7);
  useCowEyes(babyRef, mouseRef, 4);

  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, bottom: 0, width: '58%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 6,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.04) 45%, transparent 70%)',
        filter: 'blur(36px)', pointerEvents: 'none',
      }} />

      {/* Mama cow — bigger */}
      <div
        ref={mamaRef}
        style={{
          width: 560, height: 560,
          filter: 'drop-shadow(0 24px 56px rgba(0,0,0,0.7)) drop-shadow(0 0 40px rgba(245,158,11,0.08))',
          animation: 'cowFloat 4s ease-in-out infinite',
          flexShrink: 0,
          marginRight: -40,
        }}
      />

      {/* Baby cow — smaller, offset lower, slightly delayed float */}
      <div
        ref={babyRef}
        style={{
          width: 220, height: 220,
          filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.6)) drop-shadow(0 0 20px rgba(245,158,11,0.07))',
          animation: 'cowFloat 3.2s ease-in-out 0.8s infinite',
          flexShrink: 0,
          alignSelf: 'flex-end',
          marginBottom: '12%',
        }}
      />
    </div>
  );
}

/* ─── Floating background shapes ────────────────────────────────────── */
function FloatingBackground() {
  return (
    <>
      {/* Large ambient glow orbs */}
      <div className="orb orb-amber-xl" style={{ width:700, height:700, top:'-20%', left:'-10%' }} />
      <div className="orb orb-white-xl" style={{ width:600, height:600, top:'20%', left:'25%', animationDelay:'-3s', animationDuration:'18s' }} />
      <div className="orb orb-amber-xl" style={{ width:600, height:600, top:'-15%', right:'-10%', animationDelay:'-6s', animationDuration:'20s' }} />
      <div className="orb orb-white-xl" style={{ width:500, height:500, bottom:'-15%', left:'30%', animationDelay:'-10s', animationDuration:'24s' }} />
      <div className="orb orb-amber-xl" style={{ width:450, height:450, bottom:'-10%', right:'-5%', animationDelay:'-4s', animationDuration:'16s' }} />

      {/* Medium floating orbs */}
      {[
        { id:'o1', cls:'orb-amber-md', w:130, t:'15%', l:'10%',  d:'-1s',  dur:'10s' },
        { id:'o2', cls:'orb-white-md', w:100, t:'60%', l:'5%',   d:'-4s',  dur:'9s'  },
        { id:'o3', cls:'orb-amber-md', w:90,  t:'40%', l:'45%',  d:'-7s',  dur:'12s' },
        { id:'o4', cls:'orb-white-md', w:70,  t:'8%',  l:'70%',  d:'-2s',  dur:'8s'  },
        { id:'o5', cls:'orb-amber-md', w:110, t:'72%', l:'55%',  d:'-5s',  dur:'11s' },
        { id:'o6', cls:'orb-white-md', w:80,  t:'30%', l:'80%',  d:'-9s',  dur:'14s' },
        { id:'o7', cls:'orb-amber-md', w:60,  t:'85%', l:'88%',  d:'-3s',  dur:'10s' },
      ].map(o => (
        <div key={o.id} className={`orb ${o.cls}`}
          style={{ width:o.w, height:o.w, top:o.t, left:o.l, animationDelay:o.d, animationDuration:o.dur }} />
      ))}

      {/* Twinkling stars */}
      {[
        { top:'5%',  left:'8%',   s:3, d:'0s'    }, { top:'12%', left:'32%', s:2, d:'-1s'   },
        { top:'18%', left:'58%',  s:4, d:'-2s'   }, { top:'8%',  left:'78%', s:2, d:'-0.5s' },
        { top:'25%', left:'4%',   s:3, d:'-3s'   }, { top:'32%', left:'50%', s:2, d:'-1.5s' },
        { top:'38%', left:'88%',  s:3, d:'-4s'   }, { top:'45%', left:'20%', s:2, d:'-2.5s' },
        { top:'52%', left:'65%',  s:4, d:'-0.8s' }, { top:'60%', left:'38%', s:2, d:'-3.5s' },
        { top:'68%', left:'92%',  s:3, d:'-5s'   }, { top:'74%', left:'14%', s:2, d:'-1.2s' },
        { top:'80%', left:'72%',  s:3, d:'-6s'   }, { top:'88%', left:'28%', s:2, d:'-2.2s' },
        { top:'93%', left:'48%',  s:4, d:'-4.5s' }, { top:'3%',  left:'52%', s:2, d:'-3.8s' },
        { top:'48%', left:'96%',  s:3, d:'-1.8s' }, { top:'22%', left:'42%', s:2, d:'-7s'   },
        { top:'65%', left:'82%',  s:3, d:'-2.8s' }, { top:'90%', left:'60%', s:2, d:'-5.5s' },
      ].map((s, i) => (
        <div key={i} className="star" style={{ top:s.top, left:s.left, width:s.s, height:s.s, animationDelay:s.d }} />
      ))}

      {/* Expanding rings */}
      <div className="ring ring-1" style={{ width:180, height:180, top:'18%', left:'12%' }} />
      <div className="ring ring-2" style={{ width:120, height:120, top:'55%', left:'60%', animationDelay:'-2.5s' }} />
      <div className="ring ring-3" style={{ width:220, height:220, top:'65%', left:'4%',  animationDelay:'-5s' }} />
      <div className="ring ring-1" style={{ width:140, height:140, top:'10%', left:'78%', animationDelay:'-3.5s', animationDuration:'7s' }} />
      <div className="ring ring-2" style={{ width:100, height:100, top:'80%', left:'42%', animationDelay:'-7s',   animationDuration:'9s' }} />


      {/* Drifting lines */}
      <div className="drift-line" style={{ top:'20%', width:220, animationDelay:'-1s' }} />
      <div className="drift-line" style={{ top:'42%', width:160, animationDelay:'-5s',  animationDuration:'20s' }} />
      <div className="drift-line" style={{ top:'63%', width:140, animationDelay:'-9s',  animationDuration:'16s' }} />
      <div className="drift-line" style={{ top:'78%', width:200, animationDelay:'-3s',  animationDuration:'18s' }} />
      <div className="drift-line" style={{ top:'90%', width:120, animationDelay:'-12s', animationDuration:'22s' }} />
    </>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export default function Login() {
  const { login, user, refreshUser } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/', { replace: true }); }, []);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [filledRole, setFilledRole] = useState('');

  const [phase, setPhase]             = useState<'idle'|'slideOut'|'morph'>('idle');
  const [morphGrown, setMorphGrown]   = useState(false);
  const [ringPulse, setRingPulse]     = useState(false);
  const [morphFading, setMorphFading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [ripples, setRipples] = useState<Array<{ id: string; x: number; y: number; ring: number }>>([]);

  /* Track mouse position globally for cursor effects */
  useEffect(() => {
    const h = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  /* Post-login transition chain */
  useEffect(() => {
    if (!loginSuccess) return;
    setPhase('slideOut');
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => setPhase('morph'),       460));
    ts.push(setTimeout(() => setMorphGrown(true),     520));
    ts.push(setTimeout(() => setRingPulse(true),     1060));
    ts.push(setTimeout(() => setMorphFading(true),   1800));
    ts.push(setTimeout(() => refreshUser().finally(() => navigate('/')), 2100));
    return () => ts.forEach(clearTimeout);
  }, [loginSuccess, navigate, refreshUser]);

  /* Animated email placeholder */
  useEffect(() => {
    const text = 'admin@qa.com';
    let i = 0; let fwd = true;
    const el = emailInputRef.current;
    if (!el) return;
    const tick = () => {
      if (el.value) return;
      el.placeholder = text.slice(0, i) + '|';
      if (fwd) { i++; if (i > text.length) fwd = false; }
      else     { i--; if (i < 0) { i = 0; fwd = true; } }
    };
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setError('');
    try {
      await login(email, password);
      setLoginSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: typeof DEMO_USERS[0]) => {
    setEmail(u.email); setPassword('password123'); setFilledRole(u.role);
  };

  /* Click-to-ripple on background */
  const handleBgClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-ripple]')) return;
    const base = `${Date.now()}-${Math.random()}`;
    const { clientX: x, clientY: y } = e;
    const newRipples = [
      { id: `${base}-0`, x, y, ring: 260 },
      { id: `${base}-1`, x, y, ring: 380 },
    ];
    setRipples(prev => [...prev, ...newRipples]);
    setTimeout(() => setRipples(prev => prev.filter(r => !r.id.startsWith(base))), 1600);
  };

  const AMBER = '#F59E0B';

  return (
    <div
      onClick={handleBgClick}
      style={{
        minHeight: '100vh', position: 'relative', overflow: 'hidden',
        background: '#09090B',
        fontFamily: "'DM Sans', sans-serif",
        opacity: phase === 'slideOut' ? 0 : 1,
        transition: phase === 'slideOut' ? 'opacity 0.45s ease' : 'none',
      }}
    >
      {/* Particle trail canvas — fixed overlay */}
      <ParticleTrail />

      {/* Post-login morph overlay */}
      {phase === 'morph' && <MorphOverlay grown={morphGrown} ringPulse={ringPulse} fadingOut={morphFading} />}

      {/* ── Background stack ── */}
      <BreathingGrid />
      <AuroraLayer />
      <MorphingBlob />
      <ConstellationLayer />

      {/* Flingable shapes layer */}
      <div style={{ position:'absolute', inset:0, zIndex:1 }}>
        <FloatingBackground />
      </div>

      {/* Cursor reactive shapes */}
      <div style={{ position:'absolute', inset:0, zIndex:2, pointerEvents:'none' }}>
        <CursorReactiveShapes mouseRef={mouseRef} />
      </div>

      {/* Dust motes + cascading triangles */}
      <DustMotes />
      <CascadingTriangles />

      {/* Meteor streaks */}
      <MeteorLayer />

      {/* Click ripples */}
      {ripples.map(r => (
        <div key={r.id} style={{
          position: 'fixed', left: r.x, top: r.y,
          width: r.ring, height: r.ring,
          borderRadius: '50%',
          border: `${r.ring === 260 ? 1.5 : 1}px solid rgba(245,158,11,${r.ring === 260 ? 0.65 : 0.3})`,
          transform: 'translate(-50%,-50%) scale(0)',
          animation: `clickRipple ${r.ring === 260 ? 1.2 : 1.5}s cubic-bezier(0,0,0.2,1) ${r.ring === 260 ? '0s' : '0.1s'} forwards`,
          pointerEvents: 'none', zIndex: 20,
        }} />
      ))}

      {/* ── Cow mascot in hero area ── */}
      <CowMascot mouseRef={mouseRef} />

      {/* ── Left: brand & demo pills ── */}
      <div style={{ position:'absolute', left:'5%', top:'8%', zIndex:6, maxWidth:340 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:AMBER, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 14px ${AMBER}66` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:18, color:'white', letterSpacing:'0.04em' }}>Qlarity</span>
        </div>
        <h1 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:32, fontWeight:800, color:'white', lineHeight:1.2, marginBottom:8 }}>
          QA Asset Platform
        </h1>
        <p style={{ fontSize:15, color:'rgba(255,255,255,0.6)' }}>Clarity in every QA decision.</p>
      </div>

      <div style={{ position:'absolute', left:'5%', bottom:'6%', zIndex:6, maxWidth:340 }}>
        <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'rgba(255,255,255,0.4)', marginBottom:8 }}>Demo accounts</p>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {DEMO_USERS.map(u => (
            <button key={u.email} type="button" onClick={() => quickLogin(u)}
              style={{ padding:'5px 13px', borderRadius:999, cursor:'pointer', background:filledRole===u.role?u.color:'rgba(255,255,255,0.08)', border:`1px solid ${filledRole===u.role?u.color:'rgba(255,255,255,0.15)'}`, color:filledRole===u.role?'#09090B':'rgba(255,255,255,0.75)', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5, transition:'all 0.18s' }}>
              {filledRole === u.role && <CheckCircle2 size={11} />}
              {u.role}
            </button>
          ))}
        </div>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:6 }}>
          Password: <span style={{ fontFamily:'monospace', color:AMBER, fontWeight:700 }}>password123</span>
        </p>
      </div>

      {/* ── Login form with rotating ring ── */}
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'42%', zIndex:7, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 48px' }}>
        <div data-no-ripple style={{ position:'relative', width:'100%', maxWidth:420 }}>

          {/* 11 — Rotating amber ring around card */}
          <div style={{ position:'absolute', inset:-3, borderRadius:27, border:'1px solid transparent', borderTop:`1.5px solid rgba(245,158,11,0.55)`, borderRight:`1px solid rgba(245,158,11,0.18)`, animation:'spin 4s linear infinite', pointerEvents:'none' }} />
          <div style={{ position:'absolute', inset:-3, borderRadius:27, border:'1px solid transparent', borderBottom:`1.5px solid rgba(245,158,11,0.45)`, borderLeft:`1px solid rgba(245,158,11,0.18)`, animation:'spin 6s linear infinite reverse', pointerEvents:'none' }} />

          {/* Glass card */}
          <div style={{ background:'rgba(255,255,255,0.04)', backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:28, padding:'52px 48px', boxShadow:'0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.08)' }}>

            <div style={{ textAlign:'center', marginBottom:28 }}>
              <h2 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:20, color:'white', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>USER LOGIN</h2>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.45)' }}>Welcome to Qlarity</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

              <div style={{ position:'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2" style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', zIndex:1 }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input ref={emailInputRef} type="email" value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({...p, email:''})); }}
                  placeholder="Email address"
                  style={{ width:'100%', paddingLeft:42, paddingRight:16, height:52, borderRadius:999, border:`1px solid ${errors.email?'#f87171':'rgba(245,158,11,0.25)'}`, background:errors.email?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.07)', fontSize:14, color:'white', outline:'none', transition:'border-color 0.2s,box-shadow 0.2s', boxSizing:'border-box' }}
                  onFocus={e => { e.target.style.borderColor=AMBER; e.target.style.boxShadow=`0 0 0 3px ${AMBER}22`; }}
                  onBlur={e => { e.target.style.borderColor=errors.email?'#f87171':'rgba(245,158,11,0.25)'; e.target.style.boxShadow='none'; }}
                />
                {errors.email && <p style={{ fontSize:12, color:'#f87171', marginTop:3, paddingLeft:16 }}>{errors.email}</p>}
              </div>

              <div style={{ position:'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2" style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', zIndex:1 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type={showPw?'text':'password'} value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({...p, password:''})); }}
                  placeholder="Password"
                  style={{ width:'100%', paddingLeft:42, paddingRight:46, height:52, borderRadius:999, border:`1px solid ${errors.password?'#f87171':'rgba(245,158,11,0.25)'}`, background:errors.password?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.07)', fontSize:14, color:'white', outline:'none', transition:'border-color 0.2s,box-shadow 0.2s', boxSizing:'border-box' }}
                  onFocus={e => { e.target.style.borderColor=AMBER; e.target.style.boxShadow=`0 0 0 3px ${AMBER}22`; }}
                  onBlur={e => { e.target.style.borderColor=errors.password?'#f87171':'rgba(245,158,11,0.25)'; e.target.style.boxShadow='none'; }}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(s=>!s)}
                  style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.45)', display:'flex', padding:4 }}>
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
                {errors.password && <p style={{ fontSize:12, color:'#f87171', marginTop:3, paddingLeft:16 }}>{errors.password}</p>}
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13, color:'rgba(255,255,255,0.5)' }}>
                  <input type="checkbox" style={{ accentColor:AMBER, width:14, height:14 }} />
                  Remember
                </label>
                <Link to="/forgot-password" style={{ fontSize:13, color:'rgba(255,255,255,0.5)', textDecoration:'none' }}>
                  Forgot password ?
                </Link>
              </div>

              {error && (
                <div style={{ display:'flex', alignItems:'center', gap:8, borderRadius:12, padding:'10px 16px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', fontSize:13 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width:'100%', height:52, borderRadius:10, border:'none', background:AMBER, color:'#09090B', fontWeight:700, fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:'0.1em', textTransform:'uppercase', cursor:loading?'not-allowed':'pointer', opacity:loading?0.75:1, boxShadow:`0 4px 20px ${AMBER}55`, transition:'background 0.2s,transform 0.15s,box-shadow 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background='#D97706'; (e.currentTarget as HTMLElement).style.transform='translateY(-1px)'; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background=AMBER; (e.currentTarget as HTMLElement).style.transform='translateY(0)'; }}
              >
                {loading
                  ? <><span style={{ width:15, height:15, border:'2px solid #09090B', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }}/> Signing in…</>
                  : 'Login'
                }
              </button>

              <p style={{ textAlign:'center', fontSize:13, color:'rgba(255,255,255,0.4)', marginTop:4 }}>
                <Link to="/forgot-password" style={{ color:'rgba(255,255,255,0.7)', fontWeight:500, textDecoration:'none' }}>Create Account</Link>
              </p>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Core ── */
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ringExpand {
          from { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
          to   { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
        }

        /* ── 1. Breathing grid ── */
        @keyframes gridPulse {
          0%,100% { opacity: 0.45; }
          50%     { opacity: 1; }
        }

        /* ── 2. Aurora ── */
        @keyframes auroraDrift {
          0%,100% { transform: translateY(0) scaleX(1); opacity: 0.65; }
          50%     { transform: translateY(-28px) scaleX(1.04); opacity: 1; }
        }

        /* ── 3. Morphing blob ── */
        @keyframes blobMorph {
          0%,100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          25%     { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
          50%     { border-radius: 50% 60% 30% 60% / 30% 60% 50% 40%; }
          75%     { border-radius: 70% 30% 50% 50% / 40% 50% 60% 50%; }
        }

        /* ── 4. Meteors ── */
        .meteor {
          position: absolute;
          width: 110px; height: 1.5px;
          background: linear-gradient(90deg, transparent, rgba(245,158,11,0.85), white, transparent);
          transform-origin: left center;
          transform: rotate(-35deg);
          animation: meteorShoot 0.85s ease-out forwards;
        }
        @keyframes meteorShoot {
          from { opacity: 1; transform: rotate(-35deg) translateX(0) scaleX(0.05); }
          to   { opacity: 0; transform: rotate(-35deg) translateX(300px) scaleX(1); }
        }

        /* ── 5. Dust motes ── */
        .dust-mote {
          position: absolute;
          border-radius: 50%;
          background: white;
          animation: dustFloat linear infinite;
        }
        @keyframes dustFloat {
          from { transform: translateY(0) translateX(0); }
          33%  { transform: translateY(-33vh) translateX(10px); }
          66%  { transform: translateY(-66vh) translateX(-8px); }
          to   { transform: translateY(-105vh) translateX(5px); opacity: 0; }
        }

        /* ── 6. Constellation ── */
        @keyframes constellate {
          0%,100% { opacity: 0.03; }
          50%     { opacity: 0.22; }
        }

        /* ── 7. Cascading triangles ── */
        @keyframes fall {
          from { transform: translateY(0) rotate(0deg);   opacity: 0.8; }
          to   { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }

        /* ── Cow mascot ── */
        @keyframes cowFloat {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-14px); }
        }

        /* ── 9. Click ripple ── */
        @keyframes clickRipple {
          from { transform: translate(-50%,-50%) scale(0); opacity: 0.85; }
          to   { transform: translate(-50%,-50%) scale(1); opacity: 0; }
        }

        /* ── Orbs ── */
        .orb { position:absolute; border-radius:50%; filter:blur(80px); animation:orbDrift 14s ease-in-out infinite; }
        .orb-amber-xl { background: radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%); }
        .orb-white-xl { background: radial-gradient(circle, rgba(255,255,255,0.09) 0%, transparent 70%); filter:blur(60px); }
        .orb-amber-md { background: radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%); filter:blur(40px); animation-name:orbFloat; animation-duration:10s; }
        .orb-white-md { background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%); filter:blur(30px); animation-name:orbFloat; animation-duration:10s; }
        @keyframes orbDrift {
          0%,100% { transform: translate(0,0) scale(1); }
          33%     { transform: translate(18px,-22px) scale(1.04); }
          66%     { transform: translate(-12px,14px) scale(0.97); }
        }
        @keyframes orbFloat {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-18px); }
        }

        /* ── Stars ── */
        .star { position:absolute; border-radius:50%; background:white; animation:twinkle 4s ease-in-out infinite; }
        @keyframes twinkle {
          0%,100% { opacity:0.15; transform:scale(1); }
          50%     { opacity:0.9;  transform:scale(1.4); }
        }

        /* ── Expanding rings ── */
        .ring { position:absolute; border-radius:50%; border:1px solid rgba(245,158,11,0.3); animation:expandRing 6s ease-out infinite; }
        .ring-2 { animation-duration:8s;  border-color:rgba(255,255,255,0.15); }
        .ring-3 { animation-duration:10s; }
        @keyframes expandRing {
          0%   { transform:scale(0.3); opacity:0.8; }
          100% { transform:scale(2.2); opacity:0; }
        }

        /* ── Drifting lines ── */
        .drift-line { position:absolute; left:0; height:1px; background:linear-gradient(90deg,transparent,rgba(245,158,11,0.25),transparent); animation:driftLine 12s linear infinite; }
        @keyframes driftLine {
          from { transform:translateX(-100%); opacity:0; }
          10%  { opacity:1; }
          90%  { opacity:1; }
          to   { transform:translateX(120vw); opacity:0; }
        }
      `}</style>
    </div>
  );
}
