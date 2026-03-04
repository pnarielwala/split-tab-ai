"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updatePaymentMethods(data: {
  venmo_handle: string | null;
  zelle_id: string | null;
  cashapp_handle: string | null;
  paypal_id: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      venmo_handle: data.venmo_handle || null,
      zelle_id: data.zelle_id || null,
      cashapp_handle: data.cashapp_handle || null,
      paypal_id: data.paypal_id || null,
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/account");
}
