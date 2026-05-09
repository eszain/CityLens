import Link from "next/link";
import { notFound } from "next/navigation";

import { AppRouteNav } from "@/components/AppRouteNav";
import { apiBase, fetchJson } from "@/lib/api";

type MlScoring = {
  heat_risk?: "low" | "moderate" | "high" | "critical" | null;
  summary?: string | null;
  top_interventions?: string[] | null;
  confidence?: string | null;
  source?: string | null;
  model?: string | null;
};

type BlockDetail = {
  id: string;
  name?: string | null;
  external_id?: string | null;
  vulnerability_score?: number | null;
  lst_mean_c?: number | null;
  canopy_pct?: number | null;
  interventions?: Array<Record<string, unknown>>;
  work_orders?: Array<Record<string, unknown>>;
  ml_scoring?: MlScoring | null;
};

const RISK_COLORS: Record<string, { dot: string; badge: string; text: string; label: string }> = {
  low:      { dot: "bg-emerald-500", badge: "bg-emerald-50 border-emerald-200",  text: "text-emerald-800",  label: "Low" },
  moderate: { dot: "bg-yellow-500",  badge: "bg-yellow-50  border-yellow-200",   text: "text-yellow-800",   label: "Moderate" },
  high:     { dot: "bg-orange-500",  badge: "bg-orange-50  border-orange-200",   text: "text-orange-800",   label: "High" },
  critical: { dot: "bg-red-500",     badge: "bg-red-50     border-red-200",      text: "text-red-800",      label: "Critical" },
};

async function loadBlock(id: string): Promise<BlockDetail | null> {
  try {
    return await fetchJson<BlockDetail>(`/blocks/${encodeURIComponent(id)}?city=toronto`);
  } catch {
    return null;
  }
}

export default async function BlockPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const block = await loadBlock(id);
  if (!block) notFound();

  const api = apiBase();
  const ml = block.ml_scoring;
  const riskColor = ml?.heat_risk ? (RISK_COLORS[ml.heat_risk] ?? RISK_COLORS.moderate) : null;

  return (
    <div className="min-h-screen bg-[var(--cl-page)]">
      <AppRouteNav active="other" />

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-stone-500">CityLens · Block</p>
            <h1 className="font-display text-2xl font-semibold text-stone-800">
              {block.name ?? "Neighbourhood"}
            </h1>
            <p className="mt-1 text-sm text-stone-600">{block.external_id}</p>
          </div>
          <Link
            className="text-sm text-stone-600 underline-offset-4 hover:text-stone-800 hover:underline"
            href="/map"
          >
            ← Back to map
          </Link>
        </div>

        {/* Sensor stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Vulnerability", value: block.vulnerability_score != null ? block.vulnerability_score.toFixed(1) : "—", sub: "Rule-based composite" },
            { label: "LST (°C)",      value: block.lst_mean_c   != null ? block.lst_mean_c.toFixed(1)   : "—", sub: "Land surface temp" },
            { label: "Canopy",        value: block.canopy_pct   != null ? `${block.canopy_pct.toFixed(1)}%` : "—", sub: "Tree cover" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm">
              <p className="text-sm font-medium text-stone-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-stone-800">{value}</p>
              <p className="mt-1 text-xs text-stone-400">{sub}</p>
            </div>
          ))}
        </div>

        {/* IBM Granite AI analysis */}
        <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-stone-500">IBM Granite · Heat Island Analysis</p>
            {ml?.confidence && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">
                confidence: {ml.confidence}
              </span>
            )}
          </div>

          {ml ? (
            <>
              {/* Heat risk badge */}
              {riskColor && (
                <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${riskColor.badge} ${riskColor.text}`}>
                  <span className={`h-2 w-2 rounded-full ${riskColor.dot}`} />
                  {riskColor.label} Heat Risk
                </div>
              )}

              {/* AI summary */}
              {ml.summary && (
                <p className="mt-3 text-sm leading-relaxed text-stone-700">{ml.summary}</p>
              )}

              {/* Top interventions from Granite */}
              {ml.top_interventions && ml.top_interventions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    AI-recommended actions
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {ml.top_interventions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--cl-green-100)] text-[10px] font-bold text-[var(--cl-green-800)]">
                          {i + 1}
                        </span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-4 text-[11px] text-stone-400">
                {ml.source === "watsonx_granite"
                  ? `Powered by ${ml.model ?? "ibm/granite-3-8b-instruct"} via watsonx.ai`
                  : "Rule-based fallback (watsonx.ai unavailable)"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-stone-500">
              AI scoring disabled. Set{" "}
              <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">ENABLE_AI_SCORING=true</code>{" "}
              in backend/.env to enable Granite analysis.
            </p>
          )}
        </div>

        {/* Intervention ROI ranking */}
        <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Intervention ROI ranking</p>
          <ul className="mt-3 space-y-2 text-sm text-stone-700">
            {(block.interventions ?? []).slice(0, 6).map((row, idx) => (
              <li key={idx} className="rounded-lg border border-stone-100 bg-stone-50/80 px-3 py-2">
                <span className="font-medium">{String(row.intervention_type ?? "—")}</span>
                <span className="text-stone-600">
                  {" "}· ROI {String(row.roi_score ?? "—")} · −{String(row.projected_temp_reduction_c ?? "—")} °C · $
                  {String(row.cost_estimate_cad ?? "—")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Work orders */}
        <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Work orders</p>
          {(block.work_orders ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-stone-600">None yet — create via POST {api}/work-orders</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(block.work_orders ?? []).map((wo, idx) => (
                <li key={idx} className="rounded-lg border border-stone-100 px-3 py-2">
                  <span className="font-medium text-stone-800">{String(wo.status ?? "—")}</span>
                  <span className="text-stone-600"> · {String(wo.department_name ?? "")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
