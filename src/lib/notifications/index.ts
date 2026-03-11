export type { NotificationChannel, ReminderPayload, PaymentMethods } from "./types";

import { sendEmail } from "./email";
import { sendSms } from "./sms";
import type { ReminderPayload } from "./types";

export async function sendReminder(payload: ReminderPayload): Promise<boolean> {
  if (payload.channel === "sms") return sendSms(payload);
  return sendEmail(payload);
}
