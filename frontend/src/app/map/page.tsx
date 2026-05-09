import DashboardPanel from '@/components/DashboardPanel';
import { HomeShell } from '@/components/HomeShell';

export default function MapPage() {
  return <HomeShell rightPanel={<DashboardPanel embedded />} />;
}
