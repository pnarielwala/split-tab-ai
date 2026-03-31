'use client';

import { useState } from 'react';
import { Trash2, Check, X, Merge, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { updateLineItem, deleteLineItem, splitLineItem } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import type { LineItem } from '@/types/database';

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
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [merging, setMerging] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitNames, setSplitNames] = useState<string[]>([]);
  const [splitting, setSplitting] = useState(false);

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
      toast.error('Failed to save item');
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

  async function handleMerge() {
    setMerging(true);
    try {
      await updateLineItem(item.id, billId, {
        name: mergeName,
        quantity: 1,
        unit_price: item.total_price,
        total_price: item.total_price,
      });
      setMergeOpen(false);
    } catch {
      toast.error('Failed to merge item');
    } finally {
      setMerging(false);
    }
  }

  function openSplit() {
    const names = Array.from({ length: 2 }, (_, i) => `${item.name} (${i + 1}/2)`);
    setSplitCount(2);
    setSplitNames(names);
    setSplitOpen(true);
  }

  function updateSplitCount(n: number) {
    setSplitCount(n);
    setSplitNames((prev) =>
      Array.from({ length: n }, (_, i) => prev[i] ?? `${item.name} (${i + 1}/${n})`)
    );
  }

  async function handleSplit() {
    setSplitting(true);
    try {
      await splitLineItem(item.id, billId, splitNames);
      setSplitOpen(false);
    } catch {
      toast.error('Failed to split item');
    } finally {
      setSplitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteLineItem(item.id, billId);
    } catch {
      toast.error('Failed to delete item');
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
              step="1"
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
    <>
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
        <div className="flex flex-col items-end shrink-0">
          <p className="text-sm font-medium">
            {formatCurrency(item.total_price)}
          </p>
          {item.quantity > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setMergeName(`${item.quantity}x ${item.name}`);
                setMergeOpen(true);
              }}
              title="Merge quantities into one item"
            >
              <Merge className="h-3.5 w-3.5" />
            </Button>
          )}
          {item.quantity === 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); openSplit(); }}
              title="Split into multiple items"
            >
              <Scissors className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
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

      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split item</DialogTitle>
            <DialogDescription>
              Divide &quot;{item.name}&quot; into equal-cost pieces.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Split into</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => updateSplitCount(Math.max(2, splitCount - 1))}
                  disabled={splitCount <= 2}>−</Button>
                <span className="text-sm font-medium w-4 text-center">{splitCount}</span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => updateSplitCount(Math.min(8, splitCount + 1))}
                  disabled={splitCount >= 8}>+</Button>
              </div>
              <span className="text-sm text-muted-foreground">
                · {formatCurrency(item.unit_price / splitCount)} each
              </span>
            </div>
            <div className="space-y-2">
              {splitNames.map((n, i) => (
                <Input key={i} value={n}
                  onChange={(e) => setSplitNames((prev) => {
                    const next = [...prev]; next[i] = e.target.value; return next;
                  })}
                  placeholder={`Item ${i + 1} name`}
                  className="text-sm" />
              ))}
            </div>
          </div>
          <p className="sm:hidden text-xs text-center text-amber-600 dark:text-amber-400 w-full mb-1">
            This cannot be undone.
          </p>
          <DialogFooter>
            <p className="hidden sm:block text-xs self-center text-amber-600 dark:text-amber-400 w-full mb-1">
              This cannot be undone.
            </p>
            <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSplit}
              disabled={splitting || splitNames.some((n) => !n.trim())}
            >
              {splitting ? 'Splitting…' : 'Split'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge quantities</DialogTitle>
            <DialogDescription>
              Combine {item.quantity} portions into 1 shared item to split
              evenly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Current:</span> {item.quantity} ×{' '}
                {item.name} @ {formatCurrency(item.unit_price)} ={' '}
                {formatCurrency(item.total_price)}
              </p>
              <p>
                <span className="font-medium">Merged:</span> 1 ×{' '}
                {mergeName || `${item.quantity}x ${item.name}`} @{' '}
                {formatCurrency(item.total_price)} ={' '}
                {formatCurrency(item.total_price)}
              </p>
            </div>
            <Input
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              placeholder="Merged item name"
              className="text-sm"
            />
          </div>
          <p className="sm:hidden text-xs text-center text-amber-600 dark:text-amber-400 w-full mb-1">
            This cannot be undone.
          </p>
          <DialogFooter>
            <p className="hidden sm:block text-xs self-center text-amber-600 dark:text-amber-400 w-full mb-1">
              This cannot be undone.
            </p>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || !mergeName.trim()}
            >
              {merging ? 'Merging…' : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
