import { AppRouteNav } from '@/components/AppRouteNav';
import DashboardPanel from '@/components/DashboardPanel';

export default function DashboardPage() {
  return (
    <div className="dashboard-page-root flex min-h-screen flex-col bg-[var(--cl-page)]">
      <header className="sticky top-0 z-30 shrink-0 border-b border-[var(--cl-border)] bg-[var(--cl-surface)]/98 backdrop-blur-md">
        <AppRouteNav active="dashboard" />
      </header>

      {/* Centered column: prevents edge clipping and matches map/landing rhythm */}
      <main className="flex w-full flex-1 justify-center px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <div className="w-full max-w-md sm:max-w-lg">
          <DashboardPanel />
        </div>
      </main>
    </div>
  );
}
