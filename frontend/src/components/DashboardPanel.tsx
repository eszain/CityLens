'use client';

import { useEffect, useState } from 'react';
import { useDemoMode } from '@/components/DemoProvider';
import { apiBase, fetchEquityReport } from '@/lib/api';
import { buildDemoEquityReport } from '@/lib/demoData';
import type { EquityReport } from '@/types';
import { cn } from '@/lib/utils';

function formatEquityScore(v: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (v >= 0 && v <= 1) return `${Math.round(v * 100)}%`;
  return String(v);
}

const sectionLabelClass =
  'font-display text-sm font-semibold text-[var(--cl-text-secondary)] border-b border-[var(--cl-border)] pb-1.5';
const insetCardClass =
  'w-full max-w-[248px] rounded-lg border border-[rgba(239,68,68,0.25)] border-l-[3px] border-l-[var(--cl-red-500)] bg-[var(--cl-card)] pl-8 pr-6 pb-8 pt-7 transition-[background-color] duration-150 hover:bg-[var(--cl-card-hover)]';

function DashboardSection({
  title,
  children,
  cardClassName,
  titleClassName,
}: {
  title: string;
  children: React.ReactNode;
  cardClassName?: string;
  titleClassName?: string;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className={cn(sectionLabelClass, 'w-full max-w-[248px] text-center', titleClassName)}>
        {title}
      </div>
      <div className={cn(insetCardClass, cardClassName)}>{children}</div>
    </div>
  );
}

type DashboardPanelProps = {
  embedded?: boolean;
};

export default function DashboardPanel({ embedded = false }: DashboardPanelProps) {
  const { demoMode } = useDemoMode();
  const [report, setReport] = useState<EquityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      if (demoMode) {
        setReport(buildDemoEquityReport());
        if (!cancelled) setLoading(false);
        return;
      }
      const live = await fetchEquityReport();
      if (!cancelled) {
        setReport(live);
        setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const api = apiBase();

  const outerClass = embedded
    ? 'min-w-0 bg-transparent'
    : cn(
        'min-w-0 overflow-hidden rounded-2xl border border-[var(--cl-border)]',
        'bg-[var(--cl-surface)] shadow-[0_2px_14px_rgba(42,38,33,0.06)]',
      );

  const bodyPad = embedded
    ? 'px-3 pb-10 pt-3 sm:px-4'
    : 'px-5 pb-6 pt-2 sm:px-6 sm:pb-8';

  if (loading) {
    return (
      <div className={cn(outerClass, embedded ? 'min-h-0' : '')}>
        <div className={cn(bodyPad, embedded ? 'pt-6' : 'pt-8')}>
          <p className="text-center text-sm text-[var(--cl-text-muted)]">Loading equity summary…</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={outerClass}>
        <div className={cn(bodyPad, embedded ? 'pt-4' : 'pt-6')}>
          <DashboardSection title="Status">
            <div>
              <p className="font-semibold text-[var(--cl-text-primary)]">Could not load equity report</p>
              <p className="mt-2 break-all font-mono text-[11px] text-[var(--cl-text-muted)]">
                {api}/equity/report?city=toronto
              </p>
              <p className="mt-2 text-xs text-[var(--cl-text-muted)]">
                Turn off Demo and start the FastAPI server with a seeded database.
              </p>
            </div>
          </DashboardSection>
        </div>
      </div>
    );
  }

  const metrics = (
    <div className={cn('flex flex-col gap-6', bodyPad)}>
      <DashboardSection title="Equity score">
        <div className="flex flex-col gap-4">
          <p className="font-display text-[clamp(1.35rem,4vw,1.75rem)] font-semibold leading-none tracking-tight text-[var(--cl-green-900)]">
            {formatEquityScore(report.summary.equity_score)}
          </p>
          <p className="text-xs leading-relaxed text-[var(--cl-text-muted)]">
            Higher means deployments better track vulnerability in low-income blocks (heuristic).
          </p>
        </div>
      </DashboardSection>

      <DashboardSection title="Coverage">
        <>
          <dl className="space-y-0 text-[13px] text-[var(--cl-text-secondary)]">
            <div className="flex justify-between gap-4 border-b border-[var(--cl-border)] py-3.5 pr-2">
              <dt className="max-w-[60%] text-[var(--cl-text-muted)]">Low-income blocks</dt>
              <dd className="shrink-0 pr-1 font-display text-base font-semibold tabular-nums text-[var(--cl-text-primary)]">
                {report.summary.low_income_blocks}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3.5 pr-2 last:pb-2">
              <dt className="max-w-[60%] text-[var(--cl-text-muted)]">Under-resourced alerts</dt>
              <dd className="shrink-0 pr-1 font-display text-base font-semibold tabular-nums text-[var(--cl-red-500)]">
                {report.summary.under_resourced_alerts}
              </dd>
            </div>
          </dl>
          {(report.summary.mean_vuln_low_income != null ||
            report.summary.mean_deploy_low_income != null) && (
            <p className="mt-5 border-t border-[var(--cl-border)] py-5 text-[11px] leading-relaxed text-[var(--cl-text-muted)]">
              Avg vulnerability (low-income):{' '}
              <span className="text-[var(--cl-text-secondary)]">
                {report.summary.mean_vuln_low_income ?? '—'}
              </span>
              <span className="mx-1 text-[var(--cl-border-bright)]">·</span>
              Avg deployment index:{' '}
              <span className="text-[var(--cl-text-secondary)]">
                {report.summary.mean_deploy_low_income ?? '—'}
              </span>
            </p>
          )}
        </>
      </DashboardSection>

      <DashboardSection
        title="Exports"
        titleClassName="max-w-[268px]"
        cardClassName="max-w-[268px]"
      >
        <div className="flex w-full flex-col items-center gap-5 px-2 py-2">
          {demoMode ? (
            <p className="w-full px-1 pb-3 pt-2 text-center text-[11px] leading-relaxed text-[var(--cl-text-muted)]">
              CSV export uses the live API. Turn off Demo to download a real snapshot.
            </p>
          ) : (
            <>
              <a
                href={`${api}/equity/report?city=toronto&export_format=csv`}
                className={cn(
                  'flex h-10 w-[200px] max-w-full shrink-0 items-center justify-center rounded-lg px-[10px]',
                  'bg-[var(--cl-green-700)] text-[13px] font-semibold text-[var(--cl-on-accent)]',
                  'transition-[filter,transform] hover:brightness-105 active:translate-y-px',
                )}
              >
                Download CSV
              </a>
              <p className="w-full px-1 pb-3 pt-2 text-center text-[11px] leading-relaxed text-[var(--cl-text-muted)]">
                Snapshot date: {report.as_of}
              </p>
            </>
          )}
        </div>
      </DashboardSection>
    </div>
  );

  if (embedded) {
    return <div className={cn(outerClass, 'min-h-0')}>{metrics}</div>;
  }

  return (
    <div className={outerClass}>
      <header className="border-b border-[var(--cl-border)] px-5 py-5 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cl-green-800)]">
          CityLens · Toronto
        </p>
        <h1 className="font-display mt-1.5 text-xl font-semibold tracking-tight text-[var(--cl-text-primary)] sm:text-2xl">
          City dashboard
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--cl-text-secondary)]">
          Equity summary from block and snapshot data. Export CSV for offline analysis or reporting.
        </p>
      </header>
      {metrics}
    </div>
  );
}
