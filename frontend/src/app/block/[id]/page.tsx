import Link from "next/link";
import { notFound } from "next/navigation";

import { apiBase, fetchJson } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            CityLens · Block
          </p>
          <h1 className="text-2xl font-semibold">{block.name ?? "Neighbourhood"}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{block.external_id}</p>
        </div>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          ← Back to map
        </Link>
      </div>

      <StatCard
        label="Vulnerability"
        value={block.vulnerability_score ?? "—"}
        description="Rule-based score in MVP; ML optional via API flag."
      />

      <Card>
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recommended interventions
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {(block.interventions ?? []).slice(0, 6).map((row, idx) => (
              <li
                key={idx}
                className="rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <span className="font-medium">{String(row.intervention_type ?? "—")}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · ROI {String(row.roi_score ?? "—")} · −
                  {String(row.projected_temp_reduction_c ?? "—")} °C · $
                  {String(row.cost_estimate_cad ?? "—")}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Work orders
          </p>
          {(block.work_orders ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              None yet — create via POST {api}/work-orders
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(block.work_orders ?? []).map((wo, idx) => (
                <li key={idx} className="rounded-md border border-border px-3 py-2">
                  <span className="font-medium">{String(wo.status ?? "—")}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {String(wo.department_name ?? "")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
