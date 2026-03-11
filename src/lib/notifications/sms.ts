import twilio from "twilio";
import type { ReminderPayload, PaymentMethods } from "./types";

function buildPaymentLinksText(
  methods: PaymentMethods,
  amount: number,
  billName: string
): string {
  const encodedName = encodeURIComponent(billName);
  const amountStr = amount.toFixed(2);
  const lines: string[] = [];

  if (methods.venmo_handle) {
    const handle = methods.venmo_handle.replace(/^@/, "");
    lines.push(`• Venmo: https://venmo.com/${handle}?txn=pay&amount=${amountStr}&note=${encodedName}`);
  }
  if (methods.cashapp_handle) {
    const tag = methods.cashapp_handle.startsWith("$")
      ? methods.cashapp_handle.slice(1)
      : methods.cashapp_handle;
    lines.push(`• CashApp: https://cash.app/$${tag}/${amountStr}`);
  }
  if (methods.paypal_id) {
    const isEmail = methods.paypal_id.includes("@") && !methods.paypal_id.startsWith("@");
    if (isEmail) {
      lines.push(`• PayPal: ${methods.paypal_id}`);
    } else {
      const handle = methods.paypal_id.replace(/^@/, "");
      lines.push(`• PayPal: https://paypal.me/${handle}/${amountStr}`);
    }
  }
  if (methods.zelle_id) {
    lines.push(`• Zelle: ${methods.zelle_id}`);
  }

  return lines.join("\n");
}

export async function sendSms(payload: ReminderPayload): Promise<boolean> {
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

  const paymentLinks = buildPaymentLinksText(
    payload.paymentMethods,
    payload.amount,
    payload.billName
  );

  const message = [
    `Hi ${payload.recipientName}! You owe $${payload.amount.toFixed(2)} for "${payload.billName}".`,
    ``,
    `Pay ${payload.ownerName}:`,
    paymentLinks,
  ].join("\n");

  try {
    await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: payload.recipientContact,
    });
    return true;
  } catch (err: unknown) {
    // 21610 = recipient opted out via STOP — skip silently
    const code = (err as { code?: number }).code;
    if (code !== 21610) {
      console.error(`Twilio send failed for ${payload.recipientContact}:`, err);
    }
    return false;
  }
}
