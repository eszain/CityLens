import { apiBase, fetchJson } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export default async function DashboardPanel() {
  const report = await loadReport();
  const api = apiBase();

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CityLens
        </p>
        <h2 className="text-xl font-semibold">City dashboard</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Equity summary from Supabase snapshots.
        </p>
      </div>

      {!report ? (
        <Card size="sm">
          <CardContent className="bg-amber-50 text-xs text-amber-950">
            Could not load{" "}
            <span className="font-mono">
              {api}/equity/report
            </span>
            . Start the FastAPI server and seed the database.
          </CardContent>
        </Card>
      ) : (
        <>
          <StatCard
            label="Equity score"
            value={report.summary.equity_score ?? "—"}
            description="Deployment vs. vulnerability (heuristic)."
          />

          <Card size="sm">
            <CardContent>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Coverage
              </p>
              <p className="mt-2 text-sm">
                Low-income blocks tracked:{" "}
                <strong>{report.summary.low_income_blocks}</strong>
              </p>
              <p className="mt-1 text-sm">
                Under-resourced alerts:{" "}
                <strong>{report.summary.under_resourced_alerts}</strong>
              </p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Exports
              </p>
              <a
                href={`${api}/equity/report?city=toronto&export_format=csv`}
                className={cn(buttonVariants({ variant: "outline" }), "mt-2 w-full")}
              >
                Download CSV
              </a>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Snapshot: {report.as_of}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
