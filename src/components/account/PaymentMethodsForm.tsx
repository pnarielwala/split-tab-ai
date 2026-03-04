"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatePaymentMethods } from "@/app/actions/account";

interface PaymentMethodsFormProps {
  initialValues: {
    venmo_handle: string | null;
    zelle_id: string | null;
    cashapp_handle: string | null;
    paypal_id: string | null;
  };
}

export function PaymentMethodsForm({ initialValues }: PaymentMethodsFormProps) {
  const [venmo, setVenmo] = useState(initialValues.venmo_handle ?? "");
  const [zelle, setZelle] = useState(initialValues.zelle_id ?? "");
  const [cashapp, setCashapp] = useState(initialValues.cashapp_handle ?? "");
  const [paypal, setPaypal] = useState(initialValues.paypal_id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updatePaymentMethods({
        venmo_handle: venmo || null,
        zelle_id: zelle || null,
        cashapp_handle: cashapp || null,
        paypal_id: paypal || null,
      });
      toast.success("Payment methods saved");
    } catch {
      toast.error("Failed to save payment methods");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Venmo</label>
        <input
          type="text"
          placeholder="@username"
          value={venmo}
          onChange={(e) => setVenmo(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Zelle</label>
        <input
          type="text"
          placeholder="phone or email"
          value={zelle}
          onChange={(e) => setZelle(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">CashApp</label>
        <input
          type="text"
          placeholder="$cashtag"
          value={cashapp}
          onChange={(e) => setCashapp(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">PayPal</label>
        <input
          type="text"
          placeholder="@username or email"
          value={paypal}
          onChange={(e) => setPaypal(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
