import Link from "next/link";
import { notFound } from "next/navigation";

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
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">CityLens · Block</p>
          <h1 className="text-2xl font-semibold text-zinc-900">{block.name ?? "Neighbourhood"}</h1>
          <p className="mt-1 font-mono text-sm text-zinc-600">{block.external_id}</p>
        </div>
        <Link className="text-sm text-zinc-700 underline-offset-4 hover:underline" href="/">
          ← Back to map
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vulnerability</p>
        <p className="mt-2 text-3xl font-semibold text-zinc-900">{block.vulnerability_score ?? "—"}</p>
        <p className="mt-1 text-xs text-zinc-500">Rule-based score in MVP; ML optional via API flag.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recommended interventions</p>
        <ul className="mt-3 space-y-2 text-sm text-zinc-800">
          {(block.interventions ?? []).slice(0, 6).map((row, idx) => (
            <li key={idx} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
              <span className="font-medium">{String(row.intervention_type ?? "—")}</span>
              <span className="text-zinc-600">
                {" "}
                · ROI {String(row.roi_score ?? "—")} · −{String(row.projected_temp_reduction_c ?? "—")} °C · $
                {String(row.cost_estimate_cad ?? "—")}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Work orders</p>
        {(block.work_orders ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">None yet — create via POST {api}/work-orders</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(block.work_orders ?? []).map((wo, idx) => (
              <li key={idx} className="rounded-md border border-zinc-100 px-3 py-2">
                <span className="font-medium">{String(wo.status ?? "—")}</span>
                <span className="text-zinc-600"> · {String(wo.department_name ?? "")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
