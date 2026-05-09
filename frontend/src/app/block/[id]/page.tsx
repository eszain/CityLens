import Link from "next/link";
import { notFound } from "next/navigation";

import { AppRouteNav } from "@/components/AppRouteNav";
import { apiBase, fetchJson } from "@/lib/api";

type BlockDetail = {
  id: string;
  name?: string | null;
  external_id?: string | null;
  vulnerability_score?: number | null;
  interventions?: Array<Record<string, unknown>>;
  work_orders?: Array<Record<string, unknown>>;
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

  return (
    <div className="min-h-screen bg-[var(--cl-page)]">
      <AppRouteNav active="other" />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-stone-500">CityLens · Block</p>
            <h1 className="font-display text-2xl font-semibold text-stone-800">{block.name ?? "Neighbourhood"}</h1>
            <p className="mt-1 text-sm text-stone-600">{block.external_id}</p>
          </div>
          <Link
            className="text-sm text-stone-600 underline-offset-4 hover:text-stone-800 hover:underline"
            href="/map"
          >
            ← Back to map
          </Link>
        </div>

        <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Vulnerability</p>
          <p className="mt-2 text-3xl font-semibold text-stone-800">{block.vulnerability_score ?? "—"}</p>
          <p className="mt-1 text-xs text-stone-500">Rule-based score in MVP; ML optional via API flag.</p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-[var(--cl-card)] p-4 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Recommended interventions</p>
          <ul className="mt-3 space-y-2 text-sm text-stone-700">
            {(block.interventions ?? []).slice(0, 6).map((row, idx) => (
              <li key={idx} className="rounded-lg border border-stone-100 bg-stone-50/80 px-3 py-2">
                <span className="font-medium">{String(row.intervention_type ?? "—")}</span>
                <span className="text-stone-600">
                  {" "}
                  · ROI {String(row.roi_score ?? "—")} · −{String(row.projected_temp_reduction_c ?? "—")} °C · $
                  {String(row.cost_estimate_cad ?? "—")}
                </span>
              </li>
            ))}
          </ul>
        </div>

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
