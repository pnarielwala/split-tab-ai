import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, phone")
    .eq("id", user.id)
    .single();

  return (
    <>
      <TopHeader title="Account" />
      <PageContainer>
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            {profile?.display_name && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{profile.display_name}</p>
              </div>
            )}
            {(profile?.email ?? user.email) && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{profile?.email ?? user.email}</p>
              </div>
            )}
            {(profile?.phone ?? user.phone) && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{profile?.phone ?? user.phone}</p>
              </div>
            )}
          </div>
          <SignOutButton />
        </div>
      </PageContainer>
    </>
  );
}
