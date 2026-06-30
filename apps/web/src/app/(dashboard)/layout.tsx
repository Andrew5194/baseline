import { Sidebar } from "../components/sidebar";
import { AssistantDock } from "../components/assistant-dock";
import { SessionToast } from "../components/session-toast";

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
      <SessionToast />
    </>
  );
}
