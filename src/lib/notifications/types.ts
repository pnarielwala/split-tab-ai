export type NotificationChannel = 'email' | 'sms';

export interface PaymentMethods {
  venmo_handle: string | null;
  zelle_id: string | null;
  cashapp_handle: string | null;
  paypal_id: string | null;
}

export interface ReminderPayload {
  channel: NotificationChannel;
  recipientName: string;
  recipientContact: string; // email address or E.164 phone
  ownerName: string;
  billName: string;
  billId: string;
  amount: number;
  paymentMethods: PaymentMethods;
}
