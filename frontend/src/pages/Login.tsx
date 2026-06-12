import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  { email: 'admin@qa.com',     role: 'Admin',    color: '#ef4444' },
  { email: 'lead@qa.com',      role: 'Lead',     color: '#8b5cf6' },
  { email: 'engineer1@qa.com', role: 'Engineer', color: '#3b82f6' },
  { email: 'viewer@qa.com',    role: 'Viewer',   color: '#64748b' },
];

/* ─── Dashboard Mockup SVG ─────────────────────────────────────── */
function DashboardMockup() {
  return (
    <svg viewBox="0 0 440 520" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 440 }}>
      {/* Card shadow */}
      <rect x="18" y="22" width="404" height="476" rx="22" fill="rgba(8,164,156,0.10)" />
      {/* Card body */}
      <rect x="10" y="14" width="404" height="476" rx="20" fill="white" />
      <rect x="10" y="14" width="404" height="476" rx="20" stroke="rgba(8,164,156,0.15)" strokeWidth="1.5" />

      {/* Top bar */}
      <rect x="10" y="14" width="404" height="50" rx="20" fill="#f8fffe" />
      <rect x="10" y="44" width="404" height="20" fill="#f8fffe" />
      <circle cx="42" cy="39" r="10" fill="rgba(8,164,156,0.12)" />
      <circle cx="42" cy="39" r="5" fill="#08a49c" opacity="0.7" />
      <rect x="62" y="33" width="80" height="8" rx="4" fill="#0f172a" opacity="0.7" />
      <rect x="62" y="45" width="50" height="5" rx="2.5" fill="#94a3b8" opacity="0.5" />
      <rect x="330" y="29" width="64" height="22" rx="11" fill="rgba(8,164,156,0.1)" />
      <rect x="340" y="35" width="44" height="9" rx="4.5" fill="#08a49c" opacity="0.6" />

      {/* Divider */}
      <line x1="10" y1="64" x2="414" y2="64" stroke="#e2e8f0" strokeWidth="1" />

      {/* ─ Pie chart section ─ */}
      <text x="30" y="92" fontFamily="DM Sans,sans-serif" fontSize="11" fill="#64748b" fontWeight="600" letterSpacing="0.05em">TEST COVERAGE</text>
      {/* Pie chart */}
      <circle cx="100" cy="145" r="38" fill="#f0fdfc" />
      {/* Segments */}
      <path d="M100,145 L100,107 A38,38 0 0,1 133,164 Z" fill="#08a49c" opacity="0.9"/>
      <path d="M100,145 L133,164 A38,38 0 0,1 85,181 Z" fill="#06b6d4" opacity="0.8"/>
      <path d="M100,145 L85,181 A38,38 0 0,1 68,120 Z" fill="#5eead4" opacity="0.7"/>
      <path d="M100,145 L68,120 A38,38 0 0,1 100,107 Z" fill="#e2e8f0" opacity="0.9"/>
      {/* Donut draw animation overlay */}
      <circle cx="100" cy="145" r="28" fill="none" stroke="#08a49c" strokeWidth="6" strokeLinecap="round"
        strokeDasharray="0 176" opacity="0.4"
        style={{ transformOrigin: '100px 145px', transform: 'rotate(-90deg)', animation: 'donutDraw 1.8s ease-out 0.3s forwards' }}/>
      <circle cx="100" cy="145" r="18" fill="white" />
      <text x="100" y="149" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="10" fontWeight="700" fill="#08a49c">72%</text>
      {/* Legend */}
      <circle cx="155" cy="120" r="5" fill="#08a49c" opacity="0.9"/>
      <text x="165" y="124" fontFamily="DM Sans,sans-serif" fontSize="10" fill="#475569">Passed</text>
      <circle cx="155" cy="137" r="5" fill="#06b6d4" opacity="0.8"/>
      <text x="165" y="141" fontFamily="DM Sans,sans-serif" fontSize="10" fill="#475569">Failed</text>
      <circle cx="155" cy="154" r="5" fill="#5eead4" opacity="0.7"/>
      <text x="165" y="158" fontFamily="DM Sans,sans-serif" fontSize="10" fill="#475569">Skipped</text>
      <circle cx="155" cy="171" r="5" fill="#e2e8f0"/>
      <text x="165" y="175" fontFamily="DM Sans,sans-serif" fontSize="10" fill="#475569">Pending</text>

      {/* ─ Bar chart section ─ */}
      <line x1="24" y1="200" x2="390" y2="200" stroke="#f1f5f9" strokeWidth="1.5"/>
      <text x="30" y="222" fontFamily="DM Sans,sans-serif" fontSize="11" fill="#64748b" fontWeight="600" letterSpacing="0.05em">WEEKLY UPLOADS</text>

      {/* Bars */}
      {[
        { x: 40,  h: 44, label: 'Mon', pct: '44', delay: '0s' },
        { x: 95,  h: 62, label: 'Tue', pct: '62', delay: '0.1s' },
        { x: 150, h: 38, label: 'Wed', pct: '38', delay: '0.2s' },
        { x: 205, h: 78, label: 'Thu', pct: '78', delay: '0.3s' },
        { x: 260, h: 55, label: 'Fri', pct: '55', delay: '0.4s' },
        { x: 315, h: 30, label: 'Sat', pct: '30', delay: '0.5s' },
      ].map(b => (
        <g key={b.label}>
          <rect x={b.x} y={310 - b.h} width="36" height={b.h} rx="6" fill="url(#barGrad)" opacity="0.85"
            style={{ transformOrigin: `${b.x + 18}px 310px`, animation: `barGrow 1.2s ease-out ${b.delay} both` }}/>
          <text x={b.x + 18} y="325" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="#94a3b8">{b.label}</text>
        </g>
      ))}
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#08a49c"/>
          <stop offset="100%" stopColor="#5eead4" stopOpacity="0.5"/>
        </linearGradient>
      </defs>

      {/* ─ List rows ─ */}
      <line x1="24" y1="340" x2="390" y2="340" stroke="#f1f5f9" strokeWidth="1.5"/>
      <text x="30" y="362" fontFamily="DM Sans,sans-serif" fontSize="11" fill="#64748b" fontWeight="600" letterSpacing="0.05em">RECENT FILES</text>

      {[
        { label: 'test-plan-v3.pdf',      status: 'Approved', sc: '#08a49c', sb: 'rgba(8,164,156,0.1)',  y: 386, delay: '0.8s' },
        { label: 'regression-suite.xlsx', status: 'Review',   sc: '#f59e0b', sb: 'rgba(245,158,11,0.1)', y: 414, delay: '1.1s' },
        { label: 'api-test-cases.json',   status: 'Draft',    sc: '#94a3b8', sb: 'rgba(148,163,184,0.1)',y: 442, delay: '1.4s' },
        { label: 'load-test-results.csv', status: 'Approved', sc: '#08a49c', sb: 'rgba(8,164,156,0.1)',  y: 470, delay: '1.7s' },
      ].map(row => (
        <g key={row.y} style={{ animation: `rowSlideIn 0.5s ease-out ${row.delay} both` }}>
          <rect x="24" y={row.y - 14} width="366" height="24" rx="6" fill={row.sb} />
          <circle cx="40" cy={row.y} r="7" fill="rgba(8,164,156,0.12)"/>
          <rect x="50" y={row.y - 4} width="3" height="8" rx="1.5" fill="#08a49c" opacity="0.6"/>
          <rect x="56" y={row.y - 5} width="3" height="10" rx="1.5" fill="#06b6d4" opacity="0.5"/>
          <text x="70" y={row.y + 4} fontFamily="DM Sans,sans-serif" fontSize="10" fill="#334155">{row.label}</text>
          <rect x="320" y={row.y - 9} width="58" height="16" rx="8" fill={row.sb} />
          <text x="349" y={row.y + 4} textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fontWeight="600" fill={row.sc}>{row.status}</text>
        </g>
      ))}
    </svg>
  );
}

/* ─── Figure: person holding chart ────────────────────────────── */
function FigureLeft() {
  return (
    <svg viewBox="0 0 120 200" fill="none" style={{ width: 90, flexShrink: 0 }}>
      {/* head */}
      <circle cx="60" cy="32" r="20" fill="#b2f0ec"/>
      <circle cx="60" cy="32" r="20" stroke="#08a49c" strokeWidth="1.5" strokeDasharray="4 3"/>
      {/* eyes */}
      <circle cx="53" cy="30" r="3" fill="#0f172a"/>
      <circle cx="67" cy="30" r="3" fill="#0f172a"/>
      <path d="M54,40 Q60,46 66,40" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* body */}
      <rect x="38" y="55" width="44" height="58" rx="12" fill="#08a49c" opacity="0.85"/>
      {/* collar detail */}
      <path d="M60,55 L52,70 L60,66 L68,70 Z" fill="white" opacity="0.3"/>
      {/* left arm holding chart */}
      <path d="M38,70 Q18,75 14,90" stroke="#08a49c" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.8"/>
      {/* right arm */}
      <path d="M82,70 Q100,78 104,90" stroke="#08a49c" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.8"/>
      {/* chart in left hand */}
      <rect x="2" y="84" width="34" height="26" rx="5" fill="white" stroke="rgba(8,164,156,0.3)" strokeWidth="1"/>
      <rect x="7"  y="98" width="5" height="8"  rx="1.5" fill="#5eead4"/>
      <rect x="14" y="93" width="5" height="13" rx="1.5" fill="#08a49c"/>
      <rect x="21" y="96" width="5" height="10" rx="1.5" fill="#06b6d4"/>
      <rect x="28" y="90" width="5" height="16" rx="1.5" fill="#0d9488"/>
      {/* legs */}
      <rect x="44" y="110" width="16" height="52" rx="8" fill="#0f172a" opacity="0.7"/>
      <rect x="64" y="110" width="16" height="52" rx="8" fill="#0f172a" opacity="0.7"/>
      {/* shoes */}
      <ellipse cx="52" cy="164" rx="12" ry="6" fill="#334155"/>
      <ellipse cx="72" cy="164" rx="12" ry="6" fill="#334155"/>
    </svg>
  );
}

/* ─── Figure: person standing ──────────────────────────────────── */
function FigureRight() {
  return (
    <svg viewBox="0 0 120 200" fill="none" style={{ width: 80, flexShrink: 0 }}>
      {/* head */}
      <circle cx="60" cy="30" r="18" fill="#a5f3eb"/>
      <circle cx="53" cy="28" r="2.5" fill="#0f172a"/>
      <circle cx="67" cy="28" r="2.5" fill="#0f172a"/>
      <path d="M54,38 Q60,44 66,38" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* body */}
      <rect x="40" y="52" width="40" height="56" rx="12" fill="#06b6d4" opacity="0.85"/>
      <path d="M60,52 L53,66 L60,62 L67,66 Z" fill="white" opacity="0.25"/>
      {/* arms */}
      <path d="M40,68 Q22,80 20,96" stroke="#06b6d4" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.8"/>
      <path d="M80,68 Q98,76 100,88" stroke="#06b6d4" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.8"/>
      {/* pointing hand */}
      <circle cx="100" cy="91" r="7" fill="#b2f0ec"/>
      {/* legs */}
      <rect x="46" y="105" width="14" height="50" rx="7" fill="#0f172a" opacity="0.65"/>
      <rect x="64" y="105" width="14" height="50" rx="7" fill="#0f172a" opacity="0.65"/>
      <ellipse cx="53" cy="157" rx="10" ry="5.5" fill="#334155"/>
      <ellipse cx="71" cy="157" rx="10" ry="5.5" fill="#334155"/>
    </svg>
  );
}

/* ─── Post-login morph overlay ─────────────────────────────────── */
function MorphOverlay({ grown, ringPulse, fadingOut }: { grown: boolean; ringPulse: boolean; fadingOut: boolean }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#eef2f7',
      opacity: fadingOut ? 0 : 1,
      transition: fadingOut ? 'opacity 0.45s ease' : 'none',
      pointerEvents: fadingOut ? 'none' : 'all',
    }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {/* Ring 1 */}
        {ringPulse && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 80, height: 80, borderRadius: 22,
            transform: 'translate(-50%,-50%)',
            border: '2px solid rgba(8,164,156,0.5)',
            animation: 'ringExpand 0.55s ease-out forwards',
            pointerEvents: 'none',
          }} />
        )}
        {/* Ring 2 */}
        {ringPulse && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 80, height: 80, borderRadius: 22,
            transform: 'translate(-50%,-50%)',
            border: '1.5px solid rgba(8,164,156,0.25)',
            animation: 'ringExpand 0.55s ease-out 0.18s forwards',
            pointerEvents: 'none',
          }} />
        )}
        {/* Logo icon */}
        <div style={{
          width: grown ? 80 : 40, height: grown ? 80 : 40,
          borderRadius: grown ? 22 : 10,
          background: 'linear-gradient(135deg,#08a49c,#06b6d4)',
          boxShadow: '0 8px 32px rgba(8,164,156,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: [
            'width 0.5s cubic-bezier(0.34,1.3,0.64,1)',
            'height 0.5s cubic-bezier(0.34,1.3,0.64,1)',
            'border-radius 0.5s cubic-bezier(0.34,1.3,0.64,1)',
          ].join(','),
        }}>
          <svg width={grown ? 34 : 18} height={grown ? 34 : 18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'width 0.5s cubic-bezier(0.34,1.3,0.64,1), height 0.5s cubic-bezier(0.34,1.3,0.64,1)' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        {/* Wordmark */}
        <div style={{
          overflow: 'hidden',
          opacity: grown ? 1 : 0,
          maxHeight: grown ? 40 : 0,
          transition: 'opacity 0.35s ease 0.3s, max-height 0.35s ease 0.3s',
        }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '0.04em' }}>Q-KTAMP</span>
        </div>
        {/* Subtitle */}
        <div style={{
          opacity: grown ? 1 : 0,
          transform: grown ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.3s ease 0.55s, transform 0.3s ease 0.55s',
          marginTop: -10,
        }}>
          <span style={{ fontSize: 11, color: '#5a8a86', letterSpacing: '0.04em' }}>Loading your workspace…</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Post-login dashboard preview ─────────────────────────────── */
function DashboardPreview({ visible }: { visible: boolean }) {
  const anim = (delay: string, dur: string, from: string, easing = 'ease') =>
    visible ? {
      animation: `dbReveal ${dur} ${easing} ${delay} forwards`,
      ['--db-from' as string]: from,
      opacity: 0,
    } as React.CSSProperties : { opacity: 0 } as React.CSSProperties;

  const NAV_ITEMS = ['Dashboard','Test Files','Knowledge','Approvals','Reports'];
  const BARS = [52, 74, 43, 90, 67];

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.15s ease',
      pointerEvents: visible ? 'all' : 'none',
      fontFamily: "'DM Sans',sans-serif",
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        ...anim('0.05s','0.38s','translateY(-18px)','cubic-bezier(0.25,0.8,0.4,1)'),
        height: 56, background: 'white', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#08a49c,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Q-KTAMP</span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(8,164,156,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#08a49c' }}>A</span>
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100% - 56px)' }}>
        {/* Sidebar */}
        <div style={{
          ...anim('0.14s','0.38s','translateX(-18px)','cubic-bezier(0.25,0.8,0.4,1)'),
          width: 200, background: 'white', borderRight: '1px solid #e2e8f0',
          padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {NAV_ITEMS.map((item, i) => (
            <div key={item} style={{
              ...anim(`${0.20 + i * 0.09}s`,'0.3s','translateX(-10px)'),
              padding: '9px 14px', borderRadius: 10,
              background: i === 0 ? 'rgba(8,164,156,0.1)' : 'transparent',
              color: i === 0 ? '#08a49c' : '#64748b',
              fontSize: 13, fontWeight: i === 0 ? 700 : 500,
            }}>
              {item}
            </div>
          ))}
        </div>

        {/* Main area */}
        <div style={{ flex: 1, background: '#eef2f7', padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: 'Total Files', val: '248', delta: '+12%', color: '#08a49c' },
              { label: 'Test Cases', val: '1,093', delta: '+5%', color: '#06b6d4' },
              { label: 'Pass Rate', val: '94.2%', delta: '+1.8%', color: '#0d9488' },
            ].map((card, i) => (
              <div key={card.label} style={{
                ...anim(`${0.26 + i * 0.10}s`,'0.36s','translateY(14px) scale(0.97)','cubic-bezier(0.34,1.2,0.64,1)'),
                background: 'white', borderRadius: 14, padding: '18px 20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{card.val}</div>
                <div style={{ fontSize: 11, color: card.color, fontWeight: 700, marginTop: 4 }}>{card.delta} this week</div>
              </div>
            ))}
          </div>

          {/* Chart + Files row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Chart panel */}
            <div style={{
              ...anim('0.55s','0.36s','translateY(14px) scale(0.97)','cubic-bezier(0.34,1.2,0.64,1)'),
              background: 'white', borderRadius: 14, padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Weekly Uploads</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
                {BARS.map((h, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      background: 'linear-gradient(180deg,#08a49c,#5eead4)',
                      height: `${h}%`,
                      transformOrigin: 'bottom',
                      opacity: visible ? 1 : 0,
                      animation: visible ? `dbBar 0.38s ease ${0.72 + i * 0.05}s forwards` : 'none',
                    }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Files panel */}
            <div style={{
              ...anim('0.65s','0.36s','translateY(14px) scale(0.97)','cubic-bezier(0.34,1.2,0.64,1)'),
              background: 'white', borderRadius: 14, padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Recent Files</div>
              {[
                { name: 'test-plan-v3.pdf', badge: 'Approved', color: '#08a49c' },
                { name: 'regression-suite.xlsx', badge: 'Review', color: '#f59e0b' },
                { name: 'api-test-cases.json', badge: 'Draft', color: '#94a3b8' },
              ].map((row, i) => (
                <div key={row.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none',
                  opacity: 0,
                  animation: visible ? `dbReveal 0.3s ease ${0.78 + i * 0.13}s forwards` : 'none',
                  ['--db-from' as string]: 'translateX(10px)',
                }}>
                  <span style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>{row.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: row.color, background: `${row.color}18`, padding: '3px 8px', borderRadius: 6 }}>{row.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div style={{
        position: 'absolute', bottom: 28, right: 28,
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'white', borderRadius: 12, padding: '12px 18px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
        border: '1px solid rgba(8,164,156,0.15)',
        opacity: 0,
        animation: visible ? 'dbReveal 0.38s ease 1.1s forwards' : 'none',
        ['--db-from' as string]: 'translateY(10px)',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(8,164,156,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#08a49c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Welcome back!</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Redirecting to dashboard…</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export default function Login() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [filledRole, setFilledRole] = useState('');

  const [phase, setPhase] = useState<'idle'|'slideOut'|'morph'|'dashboard'>('idle');
  const [morphGrown, setMorphGrown] = useState(false);
  const [ringPulse, setRingPulse] = useState(false);
  const [morphFading, setMorphFading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  // Post-login animation sequence — runs once when loginSuccess flips to true
  useEffect(() => {
    if (!loginSuccess) return;
    console.log('[anim] loginSuccess fired, starting sequence');
    setPhase('slideOut');
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => { console.log('[anim] morph'); setPhase('morph'); },          460));
    ts.push(setTimeout(() => { console.log('[anim] grown'); setMorphGrown(true); },        520));
    ts.push(setTimeout(() => { console.log('[anim] ring');  setRingPulse(true); },        1060));
    ts.push(setTimeout(() => { console.log('[anim] dashboard'); setMorphFading(true); setPhase('dashboard'); }, 1960));
    ts.push(setTimeout(() => { console.log('[anim] navigate'); navigate('/'); },          3160));
    return () => { console.log('[anim] cleanup'); ts.forEach(clearTimeout); };
  }, [loginSuccess, navigate]);

  // Typewriter on email placeholder
  useEffect(() => {
    const text = 'admin@qa.com';
    let i = 0;
    let fwd = true;
    const el = emailInputRef.current;
    if (!el) return;
    const tick = () => {
      if (el.value) return; // stop if user typed
      el.placeholder = text.slice(0, i) + '|';
      if (fwd) { i++; if (i > text.length) { fwd = false; } }
      else { i--; if (i < 0) { i = 0; fwd = true; } }
    };
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, []);

  // Floating particles
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;
    const particles: HTMLDivElement[] = [];
    for (let n = 0; n < 18; n++) {
      const d = document.createElement('div');
      const dx = (Math.random() - 0.5) * 60;
      const dy = (Math.random() - 0.5) * 60;
      d.style.cssText = `
        position:absolute;
        width:4px;height:4px;border-radius:50%;
        background:rgba(8,164,156,0.55);
        left:${Math.random()*100}%;top:${Math.random()*100}%;
        --dx:${dx}px;--dy:${dy}px;
        animation:floatParticle ${3 + Math.random()*4}s ease-in-out ${Math.random()*3}s infinite;
        pointer-events:none;
      `;
      container.appendChild(d);
      particles.push(d);
    }
    return () => particles.forEach(d => d.remove());
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
      console.log('[anim] login OK, setting loginSuccess');
      setLoginSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: typeof DEMO_USERS[0]) => {
    setEmail(u.email);
    setPassword('password123');
    setFilledRole(u.role);
  };

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif", background: '#eef2f7' }}>

      {/* ── Post-login overlays ── */}
      {(phase === 'morph' || phase === 'dashboard') && (
        <MorphOverlay grown={morphGrown} ringPulse={ringPulse} fadingOut={morphFading} />
      )}
      <DashboardPreview visible={phase === 'dashboard'} />

      {/* ── Background blobs ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>{`
            @keyframes morphBlob1 {
              0%,100% { d: path("M420,80 C520,20 640,100 620,240 C600,380 480,440 360,400 C240,360 160,240 200,140 C240,40 320,140 420,80Z"); }
              50%     { d: path("M460,60 C560,0 660,120 640,260 C620,400 500,460 380,420 C260,380 140,260 180,160 C220,60 360,120 460,60Z"); }
            }
            @keyframes morphBlob2 {
              0%,100% { d: path("M0,300 C40,180 140,100 260,160 C380,220 420,360 360,460 C300,560 140,580 60,500 C-20,420 -40,420 0,300Z"); }
              50%     { d: path("M20,320 C60,200 160,80 280,140 C400,200 440,380 380,480 C320,580 160,580 80,500 C0,420 -20,440 20,320Z"); }
            }
            @keyframes morphBlob3 {
              0%,100% { d: path("M900,400 C980,300 1020,180 960,100 C900,20 780,60 720,160 C660,260 700,400 780,440 C860,480 820,500 900,400Z"); }
              50%     { d: path("M920,380 C1000,280 1040,160 980,80 C920,0 800,40 740,140 C680,240 720,380 800,420 C880,460 840,480 920,380Z"); }
            }
            @keyframes floatCard {
              0%,100% { transform: translateY(0px) rotate(-1deg); }
              50%     { transform: translateY(-14px) rotate(1deg); }
            }
            @keyframes fadeInField {
              from { opacity:0; transform: translateY(16px); }
              to   { opacity:1; transform: translateY(0); }
            }
          `}</style>
        </defs>
        <path style={{ animation: 'morphBlob1 12s ease-in-out infinite' }} fill="rgba(8,164,156,0.10)" />
        <path style={{ animation: 'morphBlob2 15s ease-in-out infinite' }} fill="rgba(6,182,212,0.08)" />
        <path style={{ animation: 'morphBlob3 18s ease-in-out infinite' }} fill="rgba(94,234,212,0.08)" />
      </svg>

      {/* Decorative orbs */}
      <div className="absolute pointer-events-none" style={{ width: 200, height: 200, borderRadius: '50%', top: -60, right: '38%', background: 'radial-gradient(circle, rgba(8,164,156,0.18) 0%, transparent 70%)', filter: 'blur(40px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ width: 160, height: 160, borderRadius: '50%', bottom: 60, left: '36%', background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)', filter: 'blur(36px)', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ width: 120, height: 120, borderRadius: '50%', top: '40%', right: 80, background: 'radial-gradient(circle, rgba(94,234,212,0.2) 0%, transparent 70%)', filter: 'blur(28px)', zIndex: 0 }} />

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="fixed top-5 right-5 z-50 w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:scale-105"
        style={{ background: 'white', border: '1px solid rgba(8,164,156,0.2)', color: '#08a49c', boxShadow: '0 2px 8px rgba(8,164,156,0.12)' }}
        title={dark ? 'Light mode' : 'Dark mode'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {dark
            ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>
            : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          }
        </svg>
      </button>

      {/* ── Morphing blob divs ── */}
      <div className="absolute pointer-events-none" style={{ width: 280, height: 280, top: '10%', left: '-8%', borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%', background: 'rgba(8,164,156,0.08)', animation: 'blobMorph1 7s ease-in-out infinite', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ width: 220, height: 220, bottom: '12%', left: '18%', borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%', background: 'rgba(8,164,156,0.07)', animation: 'blobMorph2 8s ease-in-out infinite', zIndex: 0 }} />
      <div className="absolute pointer-events-none" style={{ width: 200, height: 200, top: '55%', right: '5%', borderRadius: '50% 50% 30% 70% / 50% 70% 30% 50%', background: 'rgba(8,164,156,0.06)', animation: 'blobMorph3 10s ease-in-out infinite', zIndex: 0 }} />

      {/* ════════════════════════════════════
          LEFT — Login form
      ════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full md:w-[48%] px-8 py-12"
        style={phase === 'slideOut' ? { opacity: 0, transform: 'translateX(-55px) scale(0.96)', transition: 'opacity 0.5s ease, transform 0.5s ease', pointerEvents: 'none' } : undefined}>

      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10" style={{ animation: 'fadeInField 0.5s ease both' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#08a49c,#06b6d4)', boxShadow: '0 4px 14px rgba(8,164,156,0.35)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span className="font-extrabold text-lg tracking-wide" style={{ color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Q-KTAMP</span>
        </div>

        {/* Heading */}
        <div style={{ animation: 'fadeInField 0.55s ease 0.05s both' }}>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 36, fontWeight: 800, color: '#0f172a', lineHeight: 1.15, marginBottom: 8 }}>
            Welcome back 👋
          </h1>
          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 32 }}>
            Sign in to your QA workspace
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Email */}
          <div style={{ animation: 'fadeInField 0.6s ease 0.1s both' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Email address
            </label>
            <div style={{ position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }}
                placeholder="you@company.com"
                style={{ width: '100%', paddingLeft: 42, paddingRight: 16, height: 46, borderRadius: 12, border: `1.5px solid ${errors.email ? '#f87171' : '#e2e8f0'}`, background: 'white', fontSize: 14, color: '#0f172a', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = errors.email ? '#f87171' : '#08a49c'; e.target.style.boxShadow = `0 0 0 3px ${errors.email ? 'rgba(248,113,113,0.18)' : 'rgba(8,164,156,0.12)'}`; }}
                onBlur={e => { e.target.style.borderColor = errors.email ? '#f87171' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div style={{ animation: 'fadeInField 0.6s ease 0.18s both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#08a49c', fontWeight: 500, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                placeholder="••••••••"
                style={{ width: '100%', paddingLeft: 42, paddingRight: 44, height: 46, borderRadius: 12, border: `1.5px solid ${errors.password ? '#f87171' : '#e2e8f0'}`, background: 'white', fontSize: 14, color: '#0f172a', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = errors.password ? '#f87171' : '#08a49c'; e.target.style.boxShadow = `0 0 0 3px ${errors.password ? 'rgba(248,113,113,0.18)' : 'rgba(8,164,156,0.12)'}`; }}
                onBlur={e => { e.target.style.borderColor = errors.password ? '#f87171' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 4 }}>
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl mt-3 text-sm" style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}
          </div>

          {/* Submit */}
          <div style={{ animation: 'fadeInField 0.6s ease 0.26s both' }}>
            <button
              type="submit"
              disabled={loading || Object.values(errors).some(Boolean)}
              style={{
                width: '100%', height: 48, borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #08a49c 0%, #06b6d4 100%)',
                color: 'white', fontWeight: 700, fontSize: 15,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: '0.03em', cursor: (loading || Object.values(errors).some(Boolean)) ? 'not-allowed' : 'pointer',
                opacity: (loading || Object.values(errors).some(Boolean)) ? 0.7 : 1,
                boxShadow: '0 4px 18px rgba(8,164,156,0.38)',
                transition: 'box-shadow 0.2s, transform 0.15s',
                animation: (loading || Object.values(errors).some(Boolean)) ? 'none' : 'btnPulse 3s ease-in-out infinite',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(8,164,156,0.55)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(8,164,156,0.38)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              {loading ? (
                <><span style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> Signing in…</>
              ) : 'LOGIN →'}
            </button>
          </div>
        </form>

        {/* Demo accounts */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e2e8f0', animation: 'fadeInField 0.6s ease 0.32s both' }}>
          <p style={{ fontSize: 11, textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', marginBottom: 12 }}>
            Quick demo access
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.email}
                type="button"
                onClick={() => quickLogin(u)}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '10px 4px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.18s',
                  background: filledRole === u.role ? `${u.color}0f` : 'white',
                  border: `1.5px solid ${filledRole === u.role ? u.color + '50' : '#e2e8f0'}`,
                  boxShadow: filledRole === u.role ? `0 2px 12px ${u.color}22` : '0 1px 4px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px ${u.color}22`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = filledRole === u.role ? `0 2px 12px ${u.color}22` : '0 1px 4px rgba(0,0,0,0.04)'; }}
              >
                {filledRole === u.role && <CheckCircle2 size={10} style={{ position: 'absolute', top: 6, right: 6, color: u.color }} />}
                <div style={{ width: 26, height: 26, borderRadius: 8, background: u.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: u.color }}>{u.role[0]}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>{u.role}</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, textAlign: 'center', color: '#94a3b8', marginTop: 10 }}>
            Password: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#08a49c' }}>password123</span>
          </p>
        </div>

      </div>{/* end max-width wrapper */}
      </div>

      {/* ════════════════════════════════════
          RIGHT — Illustration panel
      ════════════════════════════════════ */}
      <div className="hidden md:flex flex-col items-center justify-center flex-1 relative z-10 px-8 py-12">
        {/* Particles layer */}
        <div ref={particlesRef} className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }} />

        {/* Figures row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', maxWidth: 480, marginBottom: -24, zIndex: 2, position: 'relative', paddingBottom: 0 }}>
          <div style={{ animation: 'bobLeft 2.5s ease-in-out infinite' }}><FigureLeft /></div>
          <div style={{ animation: 'bobRight 2.5s ease-in-out 1.2s infinite' }}><FigureRight /></div>
        </div>

        {/* Floating dashboard card */}
        <div style={{
          width: '100%', maxWidth: 460,
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          border: '1.5px solid rgba(8,164,156,0.15)',
          boxShadow: '0 24px 60px rgba(8,164,156,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          padding: '28px 28px 24px',
          animation: 'floatCard 5s ease-in-out infinite',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 16, color: '#0f172a' }}>QA Dashboard</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Last updated: just now</div>
            </div>
            <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(8,164,156,0.1)', fontSize: 12, fontWeight: 700, color: '#08a49c', display: 'flex', alignItems: 'center', gap: 5 }}>
              Live <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#08a49c', animation: 'liveBlink 1.2s steps(1) infinite' }} />
            </div>
          </div>
          <DashboardMockup />
        </div>

        {/* Bottom label */}
        <p style={{ marginTop: 20, fontSize: 12, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
          QA Knowledge &amp; Test Asset Platform
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes floatCard {
          0%,100% { transform: translateY(0px) rotate(-0.5deg); }
          50%      { transform: translateY(-14px) rotate(0.5deg); }
        }
        @keyframes fadeInField {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          @keyframes ringExpand {
            from { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
            to   { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
          }
          @keyframes dbReveal {
            from { opacity: 0; transform: var(--db-from, translateY(0)); }
            to   { opacity: 1; transform: translateY(0) translateX(0) scale(1); }
          }
          @keyframes dbBar {
            from { transform: scaleY(0); opacity: 0; }
            to   { transform: scaleY(1); opacity: 1; }
          }
          @keyframes blobMorph1 {
            0%,100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
            33%  { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
            66%  { border-radius: 50% 50% 20% 80% / 25% 80% 20% 75%; }
          }
          @keyframes blobMorph2 {
            0%,100% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
            50%  { border-radius: 70% 30% 40% 60% / 60% 40% 70% 30%; }
          }
          @keyframes blobMorph3 {
            0%,100% { border-radius: 50% 50% 30% 70% / 50% 70% 30% 50%; }
            40%  { border-radius: 30% 70% 60% 40% / 70% 30% 50% 50%; }
            80%  { border-radius: 70% 30% 50% 50% / 30% 60% 40% 70%; }
          }
          @keyframes bobLeft {
            0%,100% { transform: translateY(0px); }
            50%  { transform: translateY(-10px); }
          }
          @keyframes bobRight {
            0%,100% { transform: translateY(0px); }
            50%  { transform: translateY(-10px); }
          }
          @keyframes barGrow {
            from { transform: scaleY(0); }
            to   { transform: scaleY(1); }
          }
          @keyframes donutDraw {
            from { stroke-dasharray: 0 176; }
            to   { stroke-dasharray: 127 176; }
          }
          @keyframes rowSlideIn {
            from { opacity: 0; transform: translateX(12px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes liveBlink {
            0%,49% { opacity: 1; }
            50%,100% { opacity: 0.2; }
          }
          @keyframes floatParticle {
            0%,100% { transform: translate(0,0); opacity: 0.6; }
            50%  { transform: translate(var(--dx),var(--dy)); opacity: 0.15; }
          }
          @keyframes btnPulse {
            0%,100% { box-shadow: 0 4px 18px rgba(8,164,156,0.38); }
            50%  { box-shadow: 0 4px 32px rgba(8,164,156,0.65), 0 0 0 8px rgba(8,164,156,0.08); }
          }
        }
      `}</style>
    </div>
  );
}
