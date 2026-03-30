import { Resend } from "resend";
import type { ReminderPayload, PaymentMethods } from "./types";

function buildPaymentLinksHtml(
  methods: PaymentMethods,
  amount: number,
  billName: string
): string {
  const encodedName = encodeURIComponent(billName);
  const amountStr = amount.toFixed(2);
  const links: string[] = [];

  if (methods.venmo_handle) {
    const handle = methods.venmo_handle.replace(/^@/, "");
    links.push(
      `<a href="https://venmo.com/${handle}?txn=pay&amount=${amountStr}&note=${encodedName}" style="display:inline-block;margin:4px 8px 4px 0;padding:8px 16px;background:#3D95CE;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Pay via Venmo</a>`
    );
  }
  if (methods.cashapp_handle) {
    const tag = methods.cashapp_handle.startsWith("$")
      ? methods.cashapp_handle.slice(1)
      : methods.cashapp_handle;
    links.push(
      `<a href="https://cash.app/$${tag}/${amountStr}" style="display:inline-block;margin:4px 8px 4px 0;padding:8px 16px;background:#00D64F;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Pay via Cash App</a>`
    );
  }
  if (methods.paypal_id) {
    const isEmail = methods.paypal_id.includes("@") && !methods.paypal_id.startsWith("@");
    if (isEmail) {
      links.push(
        `<span style="display:inline-block;margin:4px 0;font-size:14px;">PayPal: <strong>${methods.paypal_id}</strong></span>`
      );
    } else {
      const handle = methods.paypal_id.replace(/^@/, "");
      links.push(
        `<a href="https://paypal.me/${handle}/${amountStr}" style="display:inline-block;margin:4px 8px 4px 0;padding:8px 16px;background:#003087;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Pay via PayPal</a>`
      );
    }
  }
  if (methods.zelle_id) {
    links.push(
      `<span style="display:inline-block;margin:4px 0;font-size:14px;">Zelle: <strong>${methods.zelle_id}</strong></span>`
    );
  }

  return links.join("\n");
}

export async function sendEmail(payload: ReminderPayload): Promise<boolean> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = `Split Tab AI <${process.env.RESEND_FROM_EMAIL}>`;

  const paymentLinksHtml = buildPaymentLinksHtml(
    payload.paymentMethods,
    payload.amount,
    payload.billName
  );

  const APP_URL =
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">
  <h2 style="margin-top:0;">Payment reminder</h2>
  <p>Hi ${payload.recipientName},</p>
  <p>
    You owe <strong>$${payload.amount.toFixed(2)}</strong> for
    <strong>${payload.billName}</strong>.
  </p>
  <p>Pay ${payload.ownerName}:</p>
  <div style="margin:16px 0;">
    ${paymentLinksHtml}
  </div>
  <a href="${APP_URL}/bills/${payload.billId}?action=mark-paid"
     style="display:inline-block;margin-top:16px;padding:10px 20px;background:#18181b;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;">
    Mark yourself as paid →
  </a>
  <p style="font-size:12px;color:#888;margin-top:32px;">
    Sent via SplitTab
  </p>
</body>
</html>
`.trim();

  try {
    const { error } = await resend.emails.send({
      from,
      to: payload.recipientContact,
      subject: `You owe $${payload.amount.toFixed(2)} for ${payload.billName}`,
      html,
    });
    if (error) {
      console.error("Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send failed:", err);
    return false;
  }
}
