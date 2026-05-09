import { Card, CardContent } from "@/components/ui/card";

type Props = {
  label: string;
  value: React.ReactNode;
  description?: string;
};

export function StatCard({ label, value, description }: Props) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
