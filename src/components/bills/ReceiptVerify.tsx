"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Plus, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { addLineItem, updateBillTotals, confirmBill, clearBillParseData, updateBillDetails } from "@/app/actions/bills";
import { LineItemRow } from "./LineItemRow";
import { ParseLoadingState } from "./ParseLoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import type { LineItem, BillTotal } from "@/types/database";

interface ReceiptVerifyProps {
  billId: string;
  lineItems: LineItem[];
  totals: BillTotal | null;
  receiptUrl: string;
  initialName: string;
  initialDescription: string;
}

export function ReceiptVerify({ billId, lineItems, totals, receiptUrl, initialName, initialDescription }: ReceiptVerifyProps) {
  const [isPending, startTransition] = useTransition();
  const [isReparsing, setIsReparsing] = useState(false);
  const [showGratuityInfo, setShowGratuityInfo] = useState(false);
  const gratuityInfoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showGratuityInfo) return;
    function handleClick(e: MouseEvent) {
      if (gratuityInfoRef.current && !gratuityInfoRef.current.contains(e.target as Node)) {
        setShowGratuityInfo(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showGratuityInfo]);

  // Bill name + description
  const [billName, setBillName] = useState(initialName);
  const [billDescription, setBillDescription] = useState(initialDescription);

  // Add item form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");

  // Totals editing
  const [tax, setTax] = useState(totals?.tax != null ? String(totals.tax) : "");
  const [gratuity, setGratuity] = useState(totals?.gratuity != null ? String(totals.gratuity) : "");
  const [fees, setFees] = useState(totals?.fees != null ? String(totals.fees) : "");
  const [discounts, setDiscounts] = useState(totals?.discounts != null ? String(totals.discounts) : "");
  const [selectedTipPct, setSelectedTipPct] = useState<number | null>(null);

  async function handleSaveBillDetails() {
    const fd = new FormData();
    fd.append("name", billName.trim() || "New Bill");
    fd.append("description", billDescription);
    const result = await updateBillDetails(billId, fd);
    if (result?.error) toast.error(result.error);
  }

  async function handleAddItem() {
    if (!newName.trim() || !newPrice.trim()) {
      toast.error("Name and price are required");
      return;
    }
    const qty = parseFloat(newQty) || 1;
    const price = parseFloat(newPrice) || 0;

    try {
      await addLineItem(billId, {
        name: newName.trim(),
        quantity: qty,
        unit_price: price,
        total_price: qty * price,
        sort_order: lineItems.length,
      });
      setNewName("");
      setNewQty("1");
      setNewPrice("");
      setShowAdd(false);
    } catch {
      toast.error("Failed to add item");
    }
  }

  async function handleSaveTotals(silent = false) {
    const subtotal = lineItems.reduce((sum, i) => sum + i.total_price, 0);
    const taxVal = tax !== "" ? parseFloat(tax) : null;
    const gratuityVal = gratuity !== "" ? parseFloat(gratuity) : null;
    const feesVal = fees !== "" ? parseFloat(fees) : null;
    const discountsVal = discounts !== "" ? parseFloat(discounts) : null;
    const total =
      subtotal + (taxVal ?? 0) + (gratuityVal ?? 0) + (feesVal ?? 0) - (discountsVal ?? 0);

    try {
      await updateBillTotals(billId, {
        subtotal,
        tax: taxVal,
        gratuity: gratuityVal,
        fees: feesVal,
        discounts: discountsVal,
        total,
        currency: totals?.currency ?? "USD",
      });
      if (!silent) toast.success("Totals saved");
    } catch {
      toast.error("Failed to save totals");
    }
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        await handleSaveTotals(true);
        await confirmBill(billId);
      } catch (err) {
        // Next.js redirect() works by throwing internally — don't treat as an error
        if ((err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
        toast.error("Failed to confirm bill");
      }
    });
  }

  async function handleReparse() {
    setIsReparsing(true);
    try {
      await clearBillParseData(billId);
      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, receiptUrl }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Parse failed" }));
        toast.error(error ?? "Receipt parsing failed");
        setIsReparsing(false);
        return;
      }
      window.location.href = `/bills/${billId}/verify`;
    } catch {
      toast.error("Re-parse failed");
      setIsReparsing(false);
    }
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.total_price, 0);
  const taxVal = tax !== "" ? parseFloat(tax) || 0 : totals?.tax ?? 0;
  const gratuityVal = gratuity !== "" ? parseFloat(gratuity) || 0 : totals?.gratuity ?? 0;
  const feesVal = fees !== "" ? parseFloat(fees) || 0 : totals?.fees ?? 0;
  const discountsVal = discounts !== "" ? parseFloat(discounts) || 0 : totals?.discounts ?? 0;
  const computedTotal = subtotal + taxVal + gratuityVal + feesVal - discountsVal;

  if (isReparsing) {
    return <ParseLoadingState />;
  }

  return (
    <div className="space-y-4">
      {/* Bill name + description */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor="bill-name" className="text-sm text-muted-foreground">Bill name</Label>
          <Input
            id="bill-name"
            value={billName}
            onChange={(e) => setBillName(e.target.value)}
            placeholder="Restaurant name"
            className="font-semibold"
            onBlur={handleSaveBillDetails}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bill-description" className="text-sm text-muted-foreground">Description (optional)</Label>
          <Input
            id="bill-description"
            value={billDescription}
            onChange={(e) => setBillDescription(e.target.value)}
            placeholder="e.g. Dinner with friends"
            onBlur={handleSaveBillDetails}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Review the items extracted from your receipt. Tap any item to edit.
        </p>
      </div>

      <Separator />

      {/* Line items */}
      <div>
        {lineItems.map((item) => (
          <LineItemRow key={item.id} item={item} billId={billId} />
        ))}

        {lineItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No items yet. Add some below.
          </p>
        )}
      </div>

      {/* Add item */}
      {showAdd ? (
        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1 space-y-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Item name"
              className="h-9 text-sm"
            />
            <div className="flex gap-1">
              <Input
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                placeholder="Qty"
                type="number"
                step="0.01"
                min="0"
                className="h-7 text-xs w-16"
              />
              <span className="text-xs text-muted-foreground self-center">×</span>
              <Input
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Unit price"
                type="number"
                step="0.01"
                min="0"
                className="h-7 text-xs flex-1"
              />
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleAddItem}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add item
        </Button>
      )}

      <Separator />

      {/* Totals */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between text-sm gap-2">
          <span className="text-muted-foreground shrink-0">Tax</span>
          <Input
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="h-7 text-xs w-24 text-right"
            onBlur={() => handleSaveTotals()}
          />
        </div>

        <div className="flex items-center justify-between text-sm gap-2">
          <div className="relative flex items-center gap-1 shrink-0" ref={gratuityInfoRef}>
            <span className="text-muted-foreground">Gratuity</span>
            <button
              type="button"
              onClick={() => setShowGratuityInfo((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            {showGratuityInfo && (
              <div className="absolute left-0 top-full mt-1.5 z-10 w-56 rounded-md border border-border bg-popover p-2.5 text-xs text-muted-foreground shadow-md">
                Tip should be calculated on the subtotal minus any discounts — not including tax or fees.
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {totals?.gratuity == null && (
              <>
                {[15, 18, 20, 22].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const amount = (subtotal * pct) / 100;
                      setGratuity(amount.toFixed(2));
                      setSelectedTipPct(pct);
                    }}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      selectedTipPct === pct
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </>
            )}
            <Input
              value={gratuity}
              onChange={(e) => {
                const val = e.target.value;
                setGratuity(val);
                const parsed = parseFloat(val);
                const matched = [15, 18, 20, 22].find(
                  (pct) => Math.abs((subtotal * pct) / 100 - parsed) < 0.005
                );
                setSelectedTipPct(matched ?? null);
              }}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              className="h-7 text-xs w-24 text-right"
              onBlur={() => handleSaveTotals()}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm gap-2">
          <span className="text-muted-foreground shrink-0">Fees</span>
          <Input
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="h-7 text-xs w-24 text-right"
            onBlur={() => handleSaveTotals()}
          />
        </div>

        <div className="flex items-center justify-between text-sm gap-2">
          <span className="text-muted-foreground shrink-0">Discounts</span>
          <Input
            value={discounts}
            onChange={(e) => setDiscounts(e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="h-7 text-xs w-24 text-right"
            onBlur={() => handleSaveTotals()}
          />
        </div>

        <Separator />

        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(computedTotal)}</span>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleConfirm}
        disabled={isPending}
      >
        {isPending ? "Confirming..." : "Confirm bill"}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={handleReparse}
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Re-parse receipt
      </Button>
    </div>
  );
}
