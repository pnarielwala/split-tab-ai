'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface QRDialogContentProps {
  shareUrl: string;
  billName: string;
}

export function QRDialogContent({ shareUrl, billName }: QRDialogContentProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join this bill on Split Tab AI',
          text: `Hey! Join this bill on Split Tab AI to select what items you had at ${billName} so we can split the bill fairly 🧾`,
          url: shareUrl,
        });
        return;
      } catch {
        // cancelled or failed — fall through
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  }

  return (
    <DialogContent className="max-w-xs">
      <DialogHeader>
        <DialogTitle>Scan to join</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Sharing will include a message asking friends to join and pick their
          items.
        </p>
      </DialogHeader>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="rounded-lg bg-white p-3">
          <QRCode value={shareUrl} size={200} />
        </div>
        <p className="max-w-full break-all text-center text-xs text-muted-foreground">
          {shareUrl}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="w-full gap-1.5"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          {copied ? 'Copied!' : 'Share link'}
        </Button>
      </div>
    </DialogContent>
  );
}
