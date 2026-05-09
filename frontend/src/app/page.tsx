import DashboardPanel from "@/components/DashboardPanel";
import HomeShell from "@/components/HomeShell";

export default function Home() {
  return <HomeShell rightPanel={<DashboardPanel />} />;
}
