import { Sidebar } from "../components/sidebar";
import { AssistantDock } from "../components/assistant-dock";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <main className="ml-60 min-h-screen">{children}</main>
      <AssistantDock />
    </>
  );
}
