'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDemoMode } from '@/components/DemoProvider';

const STATS = [
  { value: '5–8°C', label: 'hotter in low-income zones' },
  { value: '467K+', label: 'people at risk in Toronto' },
  { value: '3×', label: 'less tree canopy in poor blocks' },
  { value: 'Zero', label: 'real-time maps existed — until now' },
];

const SDGS = ['SDG 10', 'SDG 11', 'SDG 13'];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const { demoMode, setDemoMode } = useDemoMode();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--cl-black)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Radial glow background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(16,185,129,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Grid pattern */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(52,211,153,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(52,211,153,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 48px',
        borderBottom: '1px solid var(--cl-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="var(--cl-green-400)" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="6" fill="var(--cl-green-400)" opacity="0.2" />
            <circle cx="16" cy="16" r="3" fill="var(--cl-green-400)" />
            <line x1="16" y1="1" x2="16" y2="8" stroke="var(--cl-green-400)" strokeWidth="1" />
            <line x1="16" y1="24" x2="16" y2="31" stroke="var(--cl-green-400)" strokeWidth="1" />
            <line x1="1" y1="16" x2="8" y2="16" stroke="var(--cl-green-400)" strokeWidth="1" />
            <line x1="24" y1="16" x2="31" y2="16" stroke="var(--cl-green-400)" strokeWidth="1" />
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--cl-text-primary)' }}>
            City<span style={{ color: 'var(--cl-green-400)' }}>Lens</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Demo toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cl-text-muted)', letterSpacing: '0.08em' }}>
              DEMO MODE
            </span>
            <button
              onClick={() => setDemoMode(!demoMode)}
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                border: '1px solid var(--cl-border-bright)',
                background: demoMode ? 'var(--cl-green-700)' : 'var(--cl-surface)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'var(--transition)',
              }}
            >
              <span style={{
                position: 'absolute',
                top: 2,
                left: demoMode ? 20 : 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: demoMode ? 'var(--cl-green-400)' : 'var(--cl-text-muted)',
                transition: 'var(--transition)',
              }} />
            </button>
          </label>

          <Link href="/dashboard" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--cl-black)',
            background: 'var(--cl-green-400)',
            padding: '8px 20px',
            borderRadius: 8,
            textDecoration: 'none',
            letterSpacing: '0.01em',
            transition: 'var(--transition)',
          }}>
            Open Dashboard →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative',
        zIndex: 10,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 48px',
        textAlign: 'center',
      }}>
        {/* SDG badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {SDGS.map(sdg => (
            <span key={sdg} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              color: 'var(--cl-green-400)',
              border: '1px solid var(--cl-green-700)',
              padding: '4px 10px',
              borderRadius: 4,
              background: 'rgba(16,185,129,0.08)',
            }}>{sdg}</span>
          ))}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(48px, 8vw, 96px)',
          fontWeight: 800,
          lineHeight: 1.0,
          letterSpacing: '-0.04em',
          marginBottom: 24,
          maxWidth: 900,
        }}>
          <span style={{ color: 'var(--cl-text-primary)' }}>The city</span>
          <br />
          <span style={{
            color: 'var(--cl-green-400)',
            textShadow: '0 0 60px rgba(52,211,153,0.3)',
          }}>burns unevenly.</span>
        </h1>

        <p style={{
          fontSize: 18,
          lineHeight: 1.7,
          color: 'var(--cl-text-secondary)',
          maxWidth: 560,
          marginBottom: 48,
          fontWeight: 300,
        }}>
          Low-income neighbourhoods run <strong style={{ color: 'var(--cl-heat-400)' }}>5–8°C hotter</strong> than wealthy ones.
          CityLens makes this inequality visible — and automates the response.
        </p>

        <div style={{ display: 'flex', gap: 16 }}>
          <Link href="/dashboard" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--cl-black)',
            background: 'var(--cl-green-400)',
            padding: '14px 32px',
            borderRadius: 10,
            textDecoration: 'none',
          }}>
            View Live Map
          </Link>
          <a href="#how" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--cl-text-secondary)',
            border: '1px solid var(--cl-border-bright)',
            padding: '14px 32px',
            borderRadius: 10,
            textDecoration: 'none',
            background: 'transparent',
          }}>
            How it works
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{
        position: 'relative',
        zIndex: 10,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: '1px solid var(--cl-border)',
      }}>
        {STATS.map((stat, i) => (
          <div key={i} style={{
            padding: '32px 24px',
            borderRight: i < 3 ? '1px solid var(--cl-border)' : 'none',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 800,
              color: i === 0 ? 'var(--cl-heat-400)' : 'var(--cl-green-400)',
              letterSpacing: '-0.03em',
              marginBottom: 6,
            }}>{stat.value}</div>
            <div style={{
              fontSize: 12,
              color: 'var(--cl-text-muted)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.4,
            }}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="how" style={{
        position: 'relative',
        zIndex: 10,
        padding: '80px 48px',
        borderTop: '1px solid var(--cl-border)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 40,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          marginBottom: 48,
          textAlign: 'center',
        }}>How it works</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, maxWidth: 1200, margin: '0 auto' }}>
          {[
            { step: '01', title: 'Ingest', desc: 'watsonx.data unifies thermal satellite imagery, IoT sensors, tree canopy, and zoning into a lakehouse.', color: 'var(--cl-green-700)' },
            { step: '02', title: 'Score', desc: 'watsonx.ai runs a heat vulnerability model — scoring each city block and ranking interventions by cost-effectiveness.', color: 'var(--cl-heat-700)' },
            { step: '03', title: 'Automate', desc: 'watsonx Orchestrate detects anomalies and routes intervention briefs to the correct city department automatically.', color: 'var(--cl-green-700)' },
            { step: '04', title: 'Monitor', desc: 'watsonx.governance audits whether resources reach low-income zones equitably — flagging disparity in real time.', color: 'var(--cl-heat-700)' },
          ].map((item) => (
            <div key={item.step} style={{
              background: 'var(--cl-card)',
              border: '1px solid var(--cl-border)',
              padding: '32px 24px',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--cl-text-muted)',
                letterSpacing: '0.1em',
                marginBottom: 12,
              }}>{item.step}</div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--cl-text-primary)',
                marginBottom: 12,
              }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--cl-text-secondary)', lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        padding: '24px 48px',
        borderTop: '1px solid var(--cl-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cl-text-muted)' }}>
          CityLens · IBM × UNSA Hackathon 2026 · Team CityLens
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cl-text-muted)' }}>
          Powered by watsonx · Built for equity
        </span>
      </footer>
    </main>
  );
}
