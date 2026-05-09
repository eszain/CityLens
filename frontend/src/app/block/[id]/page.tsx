import Link from "next/link";
import { notFound } from "next/navigation";

import { apiBase, fetchJson } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const RISK_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  low:      { bg: "bg-emerald-50",  text: "text-emerald-800",  border: "border-emerald-200", label: "Low" },
  moderate: { bg: "bg-yellow-50",   text: "text-yellow-800",   border: "border-yellow-200",  label: "Moderate" },
  high:     { bg: "bg-orange-50",   text: "text-orange-800",   border: "border-orange-200",  label: "High" },
  critical: { bg: "bg-red-50",      text: "text-red-800",      border: "border-red-200",     label: "Critical" },
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
  const riskStyle = ml?.heat_risk ? (RISK_STYLES[ml.heat_risk] ?? RISK_STYLES.moderate) : null;

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            CityLens · Block
          </p>
          <h1 className="text-2xl font-semibold">{block.name ?? "Neighbourhood"}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{block.external_id}</p>
        </div>
        <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          ← Back to map
        </Link>
      </div>

      {/* Sensor stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Vulnerability"
          value={block.vulnerability_score != null ? block.vulnerability_score.toFixed(1) : "—"}
          description="Rule-based composite"
        />
        <StatCard
          label="LST (°C)"
          value={block.lst_mean_c != null ? block.lst_mean_c.toFixed(1) : "—"}
          description="Land surface temp"
        />
        <StatCard
          label="Canopy"
          value={block.canopy_pct != null ? `${block.canopy_pct.toFixed(1)}%` : "—"}
          description="Tree cover"
        />
      </div>

      {/* Granite AI analysis */}
      {ml ? (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                IBM Granite · Heat Island Analysis
              </p>
              {ml.confidence && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  confidence: {ml.confidence}
                </span>
              )}
            </div>

            {/* Heat risk badge */}
            {riskStyle && (
              <div
                className={cn(
                  "mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold",
                  riskStyle.bg,
                  riskStyle.text,
                  riskStyle.border,
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    ml.heat_risk === "critical" ? "bg-red-500" :
                    ml.heat_risk === "high"     ? "bg-orange-500" :
                    ml.heat_risk === "moderate" ? "bg-yellow-500" : "bg-emerald-500",
                  )}
                />
                {riskStyle.label} Heat Risk
              </div>
            )}

            {/* AI summary */}
            {ml.summary && (
              <p className="mt-3 text-sm leading-relaxed text-foreground">{ml.summary}</p>
            )}

            {/* Top interventions from Granite */}
            {ml.top_interventions && ml.top_interventions.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  AI-recommended actions
                </p>
                <ul className="mt-2 space-y-1.5">
                  {ml.top_interventions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                        {i + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source attribution */}
            <p className="mt-4 text-[11px] text-muted-foreground">
              {ml.source === "watsonx_granite"
                ? `Powered by ${ml.model ?? "ibm/granite-3-8b-instruct"} via watsonx.ai`
                : "Powered by rule-based fallback (watsonx.ai unavailable)"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              IBM Granite · Heat Island Analysis
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              AI scoring is disabled. Set{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">ENABLE_AI_SCORING=true</code>{" "}
              in backend/.env to enable Granite analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rule-based interventions */}
      <Card>
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Intervention ROI ranking
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {(block.interventions ?? []).slice(0, 6).map((row, idx) => (
              <li
                key={idx}
                className="rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <span className="font-medium">{String(row.intervention_type ?? "—")}</span>
                <span className="text-muted-foreground">
                  {" "}· ROI {String(row.roi_score ?? "—")} · −
                  {String(row.projected_temp_reduction_c ?? "—")} °C · $
                  {String(row.cost_estimate_cad ?? "—")}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Work orders */}
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
                    {" "}· {String(wo.department_name ?? "")}
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
