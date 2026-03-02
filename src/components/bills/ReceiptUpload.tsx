"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ParseLoadingState } from "./ParseLoadingState";

interface ReceiptUploadProps {
  billId: string;
  userId: string;
}

export function ReceiptUpload({ billId, userId }: ReceiptUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit() {
    if (!file) return;
    setUploading(true);

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${billId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      toast.error(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("receipts").getPublicUrl(path);

    setUploading(false);
    setParsing(true);

    const res = await fetch("/api/parse-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billId, receiptPath: path, receiptUrl: publicUrl }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Parse failed" }));
      toast.error(error ?? "Receipt parsing failed");
      setParsing(false);
      return;
    }

    router.push(`/bills/${billId}/verify`);
  }

  if (parsing) {
    return <ParseLoadingState />;
  }

  return (
    <div className="space-y-4">
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border aspect-[3/4] bg-muted">
          <Image
            src={preview}
            alt="Receipt preview"
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Camera capture (mobile) */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-10 hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <Camera className="h-10 w-10 text-muted-foreground" />
            <span className="text-sm font-medium">Take a photo</span>
            <span className="text-xs text-muted-foreground">Use your camera to capture the receipt</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* File picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-3 text-sm hover:bg-accent transition-colors"
          >
            <Upload className="h-4 w-4" />
            Choose from library
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {preview && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setPreview(null);
              setFile(null);
            }}
          >
            Retake
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Parse receipt"}
          </Button>
        </div>
      )}
    </div>
  );
}
