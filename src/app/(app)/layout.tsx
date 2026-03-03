import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/layout/BottomNav";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ReactQueryProvider>
      <div className="min-h-screen">
        {children}
        <BottomNav />
      </div>
    </ReactQueryProvider>
  );
}
