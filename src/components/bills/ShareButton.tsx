"use client";

import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { QRDialogContent } from "./QRDialog";

interface ShareButtonProps {
  shareUrl: string;
}

export function ShareButton({ shareUrl }: ShareButtonProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <QrCode className="h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <QRDialogContent shareUrl={shareUrl} />
    </Dialog>
  );
}
