'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { QRDialogContent } from './QRDialog';

interface Member {
  userId: string;
  displayName: string;
  isPaid: boolean;
}

interface RequestPaymentButtonProps {
  billId: string;
  shareUrl: string;
  members: Member[];
  onTogglePaid: (userId: string, isPaid: boolean) => Promise<void>;
}

export function RequestPaymentButton({
  billId,
  shareUrl,
  members,
  onTogglePaid,
}: RequestPaymentButtonProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Track which unpaid members are checked (pre-checked by default)
  const unpaidMembers = members.filter((m) => !m.isPaid);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(unpaidMembers.map((m) => m.userId))
  );

  // Keep selectedIds in sync when members change (e.g., after toggle)
  const selectedCount = [...selectedIds].filter((id) =>
    members.find((m) => m.userId === id && !m.isPaid)
  ).length;

  function toggleSelected(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleTogglePaid(userId: string, isPaid: boolean) {
    setToggling(userId);
    try {
      await onTogglePaid(userId, isPaid);
      // If marking paid, remove from selected
      if (!isPaid) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        // If unmarking, add back to selected
        setSelectedIds((prev) => new Set([...prev, userId]));
      }
    } finally {
      setToggling(null);
    }
  }

  async function handleSendReminders() {
    setSending(true);
    const userIds = [...selectedIds].filter((id) =>
      members.find((m) => m.userId === id && !m.isPaid)
    );
    try {
      const res = await fetch('/api/send-payment-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, userIds }),
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

  const allPaid = members.length > 0 && members.every((m) => m.isPaid);

  return (
    <>
      <Button
        variant="default"
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

          {members.length === 0 ? (
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
          ) : allPaid ? (
            <p className="text-sm text-muted-foreground py-2">
              Everyone has settled up!
            </p>
          ) : (
            <>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {!member.isPaid && (
                        <input
                          type="checkbox"
                          id={`member-${member.userId}`}
                          checked={selectedIds.has(member.userId)}
                          onChange={() => toggleSelected(member.userId)}
                          className="shrink-0 h-4 w-4 rounded border-input accent-primary"
                        />
                      )}
                      <label
                        htmlFor={`member-${member.userId}`}
                        className={`text-sm truncate ${member.isPaid ? 'text-muted-foreground' : 'cursor-pointer'}`}
                      >
                        {member.displayName}
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {member.isPaid ? (
                        <>
                          <Badge variant="secondary" className="text-xs h-5 text-green-600 bg-green-50">
                            Paid ✓
                          </Badge>
                          <button
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
                            disabled={toggling === member.userId}
                            onClick={() => handleTogglePaid(member.userId, true)}
                          >
                            Unmark
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
                          disabled={toggling === member.userId}
                          onClick={() => handleTogglePaid(member.userId, false)}
                        >
                          {toggling === member.userId ? '…' : 'Mark paid'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter className="gap-2 mt-2">
                <Button
                  variant="outline"
                  onClick={() => setRequestOpen(false)}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendReminders}
                  disabled={sending || selectedCount === 0}
                >
                  {sending
                    ? 'Sending…'
                    : `Send reminders to ${selectedCount}`}
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
