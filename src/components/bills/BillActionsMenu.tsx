"use client";

import { useState, useTransition } from "react";
import { MoreVertical, QrCode, ImageIcon, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { deleteBill } from "@/app/actions/bills";
import { QRDialogContent } from "./QRDialog";

interface BillActionsMenuProps {
  billId: string;
  billName: string;
  isOwner: boolean;
  isVerified: boolean;
  shareUrl: string;
  receiptUrl: string | null;
  memberCount?: number;
}

export function BillActionsMenu({ billId, billName, isOwner, isVerified, shareUrl, receiptUrl, memberCount = 0 }: BillActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [requestPaymentOpen, setRequestPaymentOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDeleteClick() {
    setMenuOpen(false);
    setDeleteOpen(true);
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteBill(billId);
    });
  }

  async function handleSendReminders() {
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
          toast.error("Failed to send reminders");
        }
        return;
      }
      toast.success(`Reminders sent to ${data.sent} member${data.sent !== 1 ? "s" : ""}`);
      setRequestPaymentOpen(false);
    } catch {
      toast.error("Failed to send reminders");
    } finally {
      setSending(false);
    }
  }

  const hasTopItems = isVerified || !!receiptUrl;

  return (
    <>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        trigger={
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        }
      >
        {isVerified && (
          <DropdownMenuItem onClick={() => { setMenuOpen(false); setQrOpen(true); }}>
            <QrCode className="h-4 w-4" />
            Invite
          </DropdownMenuItem>
        )}
        {isVerified && isOwner && (
          <DropdownMenuItem className="whitespace-nowrap" onClick={() => { setMenuOpen(false); setRequestPaymentOpen(true); }}>
            <Send className="h-4 w-4" />
            Request payment
          </DropdownMenuItem>
        )}
        {receiptUrl && (
          <DropdownMenuItem onClick={() => { setMenuOpen(false); setReceiptOpen(true); }}>
            <ImageIcon className="h-4 w-4" />
            View receipt
          </DropdownMenuItem>
        )}
        {hasTopItems && isOwner && <DropdownMenuSeparator />}
        {isOwner && (
          <DropdownMenuItem onClick={handleDeleteClick} destructive>
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenu>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <QRDialogContent shareUrl={shareUrl} />
      </Dialog>

      {receiptUrl && (
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-sm p-3">
            <DialogTitle className="sr-only">Receipt image</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptUrl} alt="Receipt" className="w-full rounded-lg object-contain max-h-[80vh]" />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete bill?</DialogTitle>
            <DialogDescription>
              &ldquo;{billName}&rdquo; and all its line items will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestPaymentOpen} onOpenChange={setRequestPaymentOpen}>
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
                <Button variant="outline" onClick={() => setRequestPaymentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => { setRequestPaymentOpen(false); setQrOpen(true); }}>
                  Invite members
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Send a reminder to {memberCount} member{memberCount !== 1 ? "s" : ""} with
                their amount owed and your payment info.
              </p>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setRequestPaymentOpen(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button onClick={handleSendReminders} disabled={sending}>
                  {sending ? "Sending…" : "Send reminders"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
