import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/app/components/Sidebar";
import { RealtimeProvider } from "@/app/components/RealtimeProvider";
import SaleBanner from "@/app/components/SaleBanner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar session={session} />
      <RealtimeProvider>
        <SaleBanner />
        <main className="lg:ml-64 pt-14 lg:pt-0 p-4 lg:p-6">
          {children}
        </main>
      </RealtimeProvider>
    </div>
  );
}
