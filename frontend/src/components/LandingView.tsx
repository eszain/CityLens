'use client';

import Link from 'next/link';
import { CityLensLogo } from '@/components/CityLensLogo';
import { useDemoMode } from '@/components/DemoProvider';
import { DemoToggle } from '@/components/ui/demo-toggle';

const STATS = [
  { value: '5-8°C', label: 'hotter in low-income zones' },
  { value: '5 lenses', label: 'heat · equity · canopy · flood · air' },
  { value: '467K+', label: 'people at risk in Toronto' },
  { value: '3×', label: 'less tree canopy in poor blocks' },
];

const SDGS = ['SDG 10', 'SDG 11', 'SDG 13'];

/** Marketing / explainer page — default entry at `/`. */
export function LandingView() {
  const { demoMode, setDemoMode } = useDemoMode();

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--cl-page)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(135, 151, 122, 0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(184, 135, 110, 0.08) 0%, transparent 45%)',
        pointerEvents: 'none',
      }} />

      <nav style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 48px',
        borderBottom: '1px solid var(--cl-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CityLensLogo size={34} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--cl-text-primary)' }}>
            City<span style={{ color: 'var(--cl-green-700)' }}>Lens</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--cl-text-muted)', fontWeight: 500 }}>
              Demo data
            </span>
            <DemoToggle checked={demoMode} onChange={setDemoMode} />
          </label>

          <Link href="/map" style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--cl-on-accent)',
            background: 'var(--cl-green-700)',
            padding: '8px 20px',
            borderRadius: 10,
            textDecoration: 'none',
            transition: 'var(--transition)',
          }}>
            Open map
          </Link>
          <Link href="/dashboard" style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--cl-text-secondary)',
            border: '1px solid var(--cl-border-bright)',
            padding: '8px 20px',
            borderRadius: 10,
            textDecoration: 'none',
            background: 'var(--cl-card)',
            transition: 'var(--transition)',
          }}>
            Overview
          </Link>
        </div>
      </nav>

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
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {SDGS.map(sdg => (
            <span key={sdg} style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--cl-green-800)',
              border: '1px solid var(--cl-border-bright)',
              padding: '6px 12px',
              borderRadius: 999,
              background: 'var(--cl-card)',
            }}>{sdg}</span>
          ))}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(40px, 7vw, 76px)',
          fontWeight: 600,
          lineHeight: 1.08,
          letterSpacing: '-0.03em',
          marginBottom: 24,
          maxWidth: 900,
        }}>
          <span style={{ color: 'var(--cl-text-primary)' }}>See the city through</span>
          <br />
          <span style={{ color: 'var(--cl-green-800)', fontStyle: 'italic' }}>every lens that matters.</span>
        </h1>

        <p style={{
          fontSize: 18,
          lineHeight: 1.7,
          color: 'var(--cl-text-secondary)',
          maxWidth: 560,
          marginBottom: 48,
          fontWeight: 300,
        }}>
          Low-income neighbourhoods are often <strong style={{ color: 'var(--cl-heat-700)', fontWeight: 600 }}>5-8°C warmer</strong> than wealthier areas - and the same blocks shoulder higher flood risk, worse air, and thinner canopy - with equity gaps that line up.
          {' '}CityLens helps teams see those gaps clearly and coordinate a fairer response.
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/map" style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--cl-on-accent)',
            background: 'var(--cl-green-700)',
            padding: '14px 28px',
            borderRadius: 12,
            textDecoration: 'none',
          }}>
            Open map
          </Link>
          <Link href="/dashboard" style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--cl-text-secondary)',
            border: '1px solid var(--cl-border-bright)',
            padding: '14px 28px',
            borderRadius: 12,
            textDecoration: 'none',
            background: 'var(--cl-card)',
          }}>
            Overview
          </Link>
          <a href="#how" style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--cl-text-secondary)',
            border: '1px solid var(--cl-border-bright)',
            padding: '14px 28px',
            borderRadius: 12,
            textDecoration: 'none',
            background: 'var(--cl-card)',
          }}>
            How it works
          </a>
        </div>
      </section>

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
              fontSize: 28,
              fontWeight: 600,
              color: i === 0 ? 'var(--cl-heat-700)' : 'var(--cl-green-800)',
              letterSpacing: '-0.02em',
              marginBottom: 6,
            }}>{stat.value}</div>
            <div style={{
              fontSize: 13,
              color: 'var(--cl-text-muted)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.45,
              fontWeight: 500,
            }}>{stat.label}</div>
          </div>
        ))}
      </section>

      <section id="how" style={{
        position: 'relative',
        zIndex: 10,
        padding: '80px 48px',
        borderTop: '1px solid var(--cl-border)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          marginBottom: 40,
          textAlign: 'center',
          color: 'var(--cl-text-primary)',
        }}>How it works</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, maxWidth: 1200, margin: '0 auto' }}>
          {[
            { step: '01', title: 'Ingest', desc: 'watsonx.data unifies thermal imagery, canopy, zoning, flood surfaces, air-quality feeds, and IoT signals into a lakehouse.' },
            { step: '02', title: 'Score', desc: 'watsonx.ai scores each block across heat vulnerability and related environmental risk - ranking interventions by cost-effectiveness.' },
            { step: '03', title: 'Automate', desc: 'watsonx Orchestrate detects anomalies and routes intervention briefs to the correct city department automatically.' },
            { step: '04', title: 'Monitor', desc: 'watsonx.governance audits whether resources reach low-income zones equitably - flagging disparity in real time.' },
          ].map((item) => (
            <div key={item.step} style={{
              background: 'var(--cl-card)',
              border: '1px solid var(--cl-border)',
              padding: '32px 24px',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--cl-text-muted)',
                marginBottom: 10,
              }}>{item.step}</div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 21,
                fontWeight: 600,
                color: 'var(--cl-text-primary)',
                marginBottom: 12,
              }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--cl-text-secondary)', lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer style={{
        position: 'relative',
        zIndex: 10,
        padding: '24px 48px',
        borderTop: '1px solid var(--cl-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--cl-text-muted)' }}>
          CityLens · IBM × UNSA Hackathon 2026
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--cl-text-muted)' }}>
          Built for urban & environmental equity
        </span>
      </footer>
    </main>
  );
}
