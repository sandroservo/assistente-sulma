/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Sidebar } from "@/components/layout/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BroadcastDockHost } from "@/app/(dashboard)/contacts/ui/BroadcastDock";
import { ConsultantAlertHost } from "@/app/(dashboard)/chats/ui/ConsultantAlertHost";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      <GlobalSearch />
      <BroadcastDockHost />
      <ConsultantAlertHost />
    </div>
  );
}
