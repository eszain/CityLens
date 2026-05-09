import { Card, CardContent } from '@/components/ui/card';

type Props = {
  label: string;
  value: React.ReactNode;
  description?: string;
  className?: string;
};

export function StatCard({ label, value, description, className }: Props) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="!px-4 !pb-4 !pt-4 sm:!px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cl-text-muted)]">
          {label}
        </p>
        <div className="mt-2 min-w-0">{value}</div>
        {description && (
          <p className="mt-2.5 text-xs leading-relaxed text-[var(--cl-text-muted)]">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
