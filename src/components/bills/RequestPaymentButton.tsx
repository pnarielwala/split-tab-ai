'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { QRDialogContent } from './QRDialog';

interface RequestPaymentButtonProps {
  billId: string;
  memberCount: number;
  shareUrl: string;
}

export function RequestPaymentButton({
  billId,
  memberCount,
  shareUrl,
}: RequestPaymentButtonProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSendReminders() {
    setSending(true);
    try {
      const res = await fetch('/api/send-payment-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'no_payment_methods') {
          toast.error('Add payment methods in Account settings first');
        } else {
          toast.error('Failed to send reminders');
        }
        return;
      }
      toast.success(
        `Reminders sent to ${data.sent} member${data.sent !== 1 ? 's' : ''}`
      );
      setRequestOpen(false);
    } catch {
      toast.error('Failed to send reminders');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRequestOpen(true)}
        className="w-full gap-1.5"
      >
        <Send className="h-4 w-4" />
        Request payment
      </Button>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request payment</DialogTitle>
          </DialogHeader>
          {memberCount === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                No one has joined this bill yet. Invite members first so you can
                request payment from them.
              </p>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setRequestOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setRequestOpen(false);
                    setQrOpen(true);
                  }}
                >
                  Invite members
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Send a reminder to {memberCount} member
                {memberCount !== 1 ? 's' : ''} with their amount owed and your
                payment info.
              </p>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRequestOpen(false)}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button onClick={handleSendReminders} disabled={sending}>
                  {sending ? 'Sending…' : 'Send reminders'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <QRDialogContent shareUrl={shareUrl} />
      </Dialog>
    </>
  );
}
