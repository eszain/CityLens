import type { WorkOrder } from '@/types';

const STATUS_CONFIG: Record<WorkOrder['status'], { color: string; label: string }> = {
  pending:     { color: 'var(--cl-heat-500)',  label: 'Pending' },
  dispatched:  { color: 'var(--cl-heat-700)',  label: 'Sent'    },
  in_progress: { color: 'var(--cl-green-700)', label: 'Active'  },
  completed:   { color: 'var(--cl-green-800)', label: 'Done'    },
};

export function StatusBadge({ status }: { status: WorkOrder['status'] }) {
  const { color, label } = STATUS_CONFIG[status];
  return (
    <span style={{
      fontFamily: 'var(--font-body)',
      fontSize: 11,
      fontWeight: 600,
      color,
      border: `1px solid ${color}55`,
      padding: '3px 8px',
      borderRadius: 6,
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}
