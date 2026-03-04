"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface RequestPaymentButtonProps {
  billId: string;
  memberCount: number;
}

export function RequestPaymentButton({
  billId,
  memberCount,
}: RequestPaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch("/api/send-payment-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "no_payment_methods") {
          toast.error("Add payment methods in Account settings first");
        } else {
          toast.error("Failed to send texts");
        }
        return;
      }
      toast.success(`Texts sent to ${data.sent} member${data.sent !== 1 ? "s" : ""}`);
      setOpen(false);
    } catch {
      toast.error("Failed to send texts");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Request payment
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request payment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Send a text to {memberCount} member{memberCount !== 1 ? "s" : ""} with
          their amount owed and your payment info.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send texts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
