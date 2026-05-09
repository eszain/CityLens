import Link from "next/link";

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
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">CityLens</p>
          <h1 className="text-2xl font-semibold text-zinc-900">City dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Equity summary from Supabase-backed snapshots (run{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">POST /ingest/equity_snapshot</code> on the API).
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link className="text-zinc-700 underline-offset-4 hover:underline" href="/">
            Map
          </Link>
          <Link className="font-medium text-zinc-900 underline underline-offset-4" href="/dashboard">
            Dashboard
          </Link>
        </nav>
      </div>

      {!report ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Could not load <span className="font-mono">{api}/equity/report</span>. Start the FastAPI server and seed the
          database.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Equity score</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-900">
              {report.summary.equity_score ?? "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Computed from deployment vs. vulnerability (heuristic).</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Coverage</p>
            <p className="mt-2 text-sm text-zinc-800">
              Low-income blocks tracked: <strong>{report.summary.low_income_blocks}</strong>
            </p>
            <p className="mt-1 text-sm text-zinc-800">
              Under-resourced alerts: <strong>{report.summary.under_resourced_alerts}</strong>
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Exports</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a
                className="rounded-md border border-zinc-200 px-3 py-2 text-zinc-800 hover:bg-zinc-50"
                href={`${api}/equity/report?city=toronto&export_format=csv`}
              >
                Download CSV
              </a>
              <span className="self-center text-xs text-zinc-500">JSON: {report.as_of}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
