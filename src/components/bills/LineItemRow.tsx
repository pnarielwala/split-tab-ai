"use client";

import { useState } from "react";
import { Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { updateLineItem, deleteLineItem } from "@/app/actions/bills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { LineItem } from "@/types/database";

interface LineItemRowProps {
  item: LineItem;
  billId: string;
}

export function LineItemRow({ item, billId }: LineItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.quantity));
  const [unitPrice, setUnitPrice] = useState(String(item.unit_price));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const parsedQty = parseFloat(qty) || 1;
      const parsedUnitPrice = parseFloat(unitPrice) || 0;
      await updateLineItem(item.id, billId, {
        name,
        quantity: parsedQty,
        unit_price: parsedUnitPrice,
        total_price: parsedQty * parsedUnitPrice,
      });
      setEditing(false);
    } catch (err) {
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(item.name);
    setQty(String(item.quantity));
    setUnitPrice(String(item.unit_price));
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteLineItem(item.id, billId);
    } catch {
      toast.error("Failed to delete item");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 border-b">
        <div className="flex-1 min-w-0 space-y-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className="h-8 text-sm"
          />
          <div className="flex gap-1">
            <Input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              type="number"
              step="0.01"
              min="0"
              className="h-7 text-xs w-16"
            />
            <span className="text-xs text-muted-foreground self-center">×</span>
            <Input
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="Price"
              type="number"
              step="0.01"
              min="0"
              className="h-7 text-xs flex-1"
            />
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-green-600"
            onClick={handleSave}
            disabled={saving}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 py-2 border-b cursor-pointer hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
      onClick={() => setEditing(true)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.quantity} × {formatCurrency(item.unit_price)}
        </p>
      </div>
      <p className="text-sm font-medium shrink-0">
        {formatCurrency(item.total_price)}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        disabled={deleting}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
