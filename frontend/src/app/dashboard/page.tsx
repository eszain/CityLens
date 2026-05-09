import { AppRouteNav } from "@/components/AppRouteNav";
import { apiBase, fetchJson } from "@/lib/api";

type EquityReport = {
  city: string;
  as_of: string;
  summary: {
    equity_score: number | null;
    low_income_blocks: number;
    under_resourced_alerts: number;
    mean_vuln_low_income: number | null;
    mean_deploy_low_income: number | null;
  };
  alerts: unknown[];
};

async function loadReport(): Promise<EquityReport | null> {
  try {
    return await fetchJson<EquityReport>("/equity/report?city=toronto");
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const report = await loadReport();
  const api = apiBase();

  return (
    <div className="min-h-screen bg-[var(--cl-page)]">
      <AppRouteNav active="dashboard" />
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-500">CityLens</p>
          <h1 className="font-display text-2xl font-semibold text-stone-800">City dashboard</h1>
          <p className="mt-1 text-sm text-stone-600">
            Equity summary from Supabase-backed snapshots (run{" "}
            <code className="rounded-md bg-stone-200/60 px-1.5 py-0.5 text-xs text-stone-700">POST /ingest/equity_snapshot</code> on the API).
          </p>
        </div>
      </div>

      {!report ? (
        <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-5 text-sm text-stone-700 shadow-sm">
          We couldn&apos;t load <span className="rounded bg-stone-100 px-1 font-medium text-stone-800">{api}/equity/report</span>. Start the FastAPI server and seed the database when you&apos;re ready.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Equity score</p>
            <p className="mt-2 text-3xl font-semibold text-stone-800">
              {report.summary.equity_score ?? "—"}
            </p>
            <p className="mt-1 text-xs text-stone-500">From deployment vs. vulnerability (heuristic).</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Coverage</p>
            <p className="mt-2 text-sm text-stone-700">
              Low-income blocks tracked: <strong>{report.summary.low_income_blocks}</strong>
            </p>
            <p className="mt-1 text-sm text-stone-700">
              Under-resourced alerts: <strong>{report.summary.under_resourced_alerts}</strong>
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm md:col-span-2">
            <p className="text-sm font-medium text-stone-500">Exports</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a
                className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2 text-stone-700 hover:bg-stone-100"
                href={`${api}/equity/report?city=toronto&export_format=csv`}
              >
                Download CSV
              </a>
              <span className="self-center text-xs text-stone-500">JSON: {report.as_of}</span>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
