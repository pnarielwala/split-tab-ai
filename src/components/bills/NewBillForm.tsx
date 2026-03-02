"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createBill } from "@/app/actions/bills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewBillForm() {
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await createBill(formData);
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    }
    // On success, createBill redirects — no need to reset
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Bill name *</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Dinner at Nobu"
          required
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          name="description"
          placeholder="e.g. Friday night out"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating..." : "Create bill"}
      </Button>
    </form>
  );
}
