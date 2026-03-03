"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Share2, ImageIcon, Trash2 } from "lucide-react";
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

interface BillActionsMenuProps {
  billId: string;
  billName: string;
  isOwner: boolean;
  isVerified: boolean;
  shareUrl: string;
  receiptUrl: string | null;
}

export function BillActionsMenu({ billId, billName, isOwner, isVerified, shareUrl, receiptUrl }: BillActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleShare() {
    setMenuOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
        return;
      } catch {
        // cancelled or failed — fall through
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  function handleDeleteClick() {
    setMenuOpen(false);
    setDeleteOpen(true);
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteBill(billId);
    });
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
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            Share
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
    </>
  );
}
