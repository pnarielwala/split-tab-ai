'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface ViewReceiptButtonProps {
  receiptUrl: string;
}

export function ViewReceiptButton({ receiptUrl }: ViewReceiptButtonProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function handleOpen(value: boolean) {
    if (!value) setLoaded(false);
    setOpen(value);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpen(true)}
        className="gap-1.5 flex-1"
      >
        <ImageIcon className="h-4 w-4" />
        Receipt
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-sm p-3">
          <DialogTitle className="sr-only">Receipt image</DialogTitle>
          {!loaded && <Skeleton className="w-full h-96 rounded-lg" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptUrl}
            alt="Receipt"
            className={`w-full rounded-lg object-contain max-h-[80vh] ${loaded ? '' : 'hidden'}`}
            onLoad={() => setLoaded(true)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
