"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function linkUserIdentifiers(
  userId: string,
  email: string,
  phone: string
) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email,
    phone,
    email_confirm: true,
    phone_confirm: true,
  });
  return error ? { error: error.message } : { error: null };
}
