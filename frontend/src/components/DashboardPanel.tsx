'use client';

import { FileText, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDemoMode } from '@/components/DemoProvider';
import { usePetitionStore } from '@/components/PetitionStore';
import { apiBase, fetchBlocks, fetchEquityReport } from '@/lib/api';
import { buildDemoEquityReport } from '@/lib/demoData';
import { formatPetitionDate } from '@/lib/petition';
import type { Block, EquityReport } from '@/types';
import { cn } from '@/lib/utils';

const sectionLabelClass =
  'font-display text-sm font-semibold text-[var(--cl-text-secondary)] border-b border-[var(--cl-border)] pb-1.5';
const insetCardClass =
  'w-full max-w-[248px] rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] pl-8 pr-6 pb-8 pt-7';

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

function buildBlocksCsv(blocks: Block[]): string {
  const headers = [
    'id',
    'name',
    'severity',
    'income_decile',
    'heat_score',
    'temperature_delta_c',
    'tree_canopy_pct',
    'population',
    'air_quality_index',
    'pm25_ugm3',
    'flood_risk',
    'lat',
    'lng',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = blocks.map((b) =>
    [
      b.id,
      b.name,
      b.severity,
      b.incomeDecile,
      b.heatScore,
      b.temperatureDelta,
      b.treeCanopy,
      b.population,
      b.airQualityIndex,
      b.pm25Ugm3,
      b.floodRisk,
      b.lat,
      b.lng,
    ]
      .map(escape)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function DashboardPanel({ embedded = false }: DashboardPanelProps) {
  const { demoMode } = useDemoMode();
  const [report, setReport] = useState<EquityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [csvBusy, setCsvBusy] = useState(false);
  const { drafts, selectDraft, removeDraft } = usePetitionStore();

  async function handleExportBlocksCsv() {
    setCsvBusy(true);
    try {
      const blocks = await fetchBlocks(demoMode);
      const csv = buildBlocksCsv(blocks);
      const ts = new Date().toISOString().slice(0, 10);
      downloadCsv(`citylens-blocks-${ts}.csv`, csv);
    } catch (err) {
      console.error('Block CSV export failed:', err);
    } finally {
      setCsvBusy(false);
    }
  }

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
      <DashboardSection title="Coverage">
        <>
          <dl className="space-y-0 text-[13px] text-[var(--cl-text-secondary)]">
            <div className="flex justify-between gap-4 border-b border-[var(--cl-border)] py-2 pr-2">
              <dt className="max-w-[60%] text-[var(--cl-text-muted)]">Low-income blocks</dt>
              <dd className="shrink-0 pr-1 font-display text-base font-semibold tabular-nums text-[var(--cl-text-primary)]">
                {report.summary.low_income_blocks}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-2 pr-2 last:pb-2">
              <dt className="max-w-[60%] text-[var(--cl-text-muted)]">Under-resourced alerts</dt>
              <dd className="shrink-0 pr-1 font-display text-base font-semibold tabular-nums text-[var(--cl-red-500)]">
                {report.summary.under_resourced_alerts}
              </dd>
            </div>
          </dl>
          {(report.summary.mean_vuln_low_income != null ||
            report.summary.mean_deploy_low_income != null) && (
            <p className="mt-2 border-t border-[var(--cl-border)] py-2 text-[11px] leading-relaxed text-[var(--cl-text-muted)]">
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
        title="Files"
        titleClassName="max-w-[268px]"
        cardClassName="max-w-[268px] p-3"
      >
        <div className="flex w-full min-w-0 flex-col items-stretch gap-3">
          <button
            type="button"
            onClick={handleExportBlocksCsv}
            disabled={csvBusy}
            className={cn(
              'flex h-10 w-full shrink-0 items-center justify-center rounded-lg px-[10px]',
              'bg-[var(--cl-green-700)] text-[13px] font-semibold text-[var(--cl-on-accent)]',
              'transition-[filter,transform] hover:brightness-105 active:translate-y-px',
              csvBusy && 'cursor-wait opacity-70',
            )}
          >
            {csvBusy ? 'Building CSV…' : 'City block info · CSV'}
          </button>

          <div className="mt-1">
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--cl-text-muted)]">
              Drafts ({drafts.length})
            </p>
            {drafts.length === 0 ? (
              <p className="px-1 pb-1 text-[11px] leading-relaxed text-[var(--cl-text-muted)]">
                No saved petition drafts yet. Open a block, run the AI analysis, and click <strong>Draft plan</strong> to create one.
              </p>
            ) : (
              <ul className="flex w-full min-w-0 flex-col gap-1.5">
                {drafts.map((d) => (
                  <li key={d.id} className="flex w-full min-w-0 items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => selectDraft(d.id)}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--cl-border)] bg-[var(--cl-card)] px-2 py-1.5 text-left',
                        'transition-colors hover:bg-[var(--cl-card-hover)]',
                      )}
                    >
                      <FileText size={14} aria-hidden className="shrink-0 text-[var(--cl-green-800)]" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="block w-full truncate font-display text-[12px] font-semibold text-[var(--cl-text-primary)]">
                          {d.subject || 'Untitled petition'}
                        </span>
                        <span className="block w-full truncate text-[10px] text-[var(--cl-text-muted)]">
                          {d.block.name} · {formatPetitionDate(d.meta.dateCreated)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete draft "${d.subject || 'Untitled petition'}"?`)) {
                          removeDraft(d.id);
                        }
                      }}
                      aria-label="Delete draft"
                      title="Delete draft"
                      className={cn(
                        'flex w-7 shrink-0 items-center justify-center rounded-md border border-[var(--cl-border)]',
                        'bg-[var(--cl-card)] text-[var(--cl-text-muted)]',
                        'transition-colors hover:bg-[var(--cl-card-hover)] hover:text-[var(--cl-red-400)]',
                      )}
                    >
                      <Trash2 size={12} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
          City overview
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--cl-text-secondary)]">
          Equity summary from block and snapshot data. Export CSV for offline analysis or reporting.
        </p>
      </header>
      {metrics}
    </div>
  );
}
