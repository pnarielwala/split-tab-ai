import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { LineItemRow } from "@/components/bills/LineItemRow";
import type { LineItem, BillTotal } from "@/types/database";

interface BillSummaryProps {
  lineItems: LineItem[];
  totals: BillTotal | null;
  billId?: string;
  isOwner?: boolean;
}

export function BillSummary({ lineItems, totals, billId, isOwner }: BillSummaryProps) {
  const currency = totals?.currency ?? "USD";

  return (
    <div className="space-y-4">
      {/* Line items */}
      <div className="space-y-0">
        {lineItems.map((item) =>
          isOwner && billId ? (
            <LineItemRow key={item.id} item={item} billId={billId} />
          ) : (
            <div key={item.id} className="flex items-center gap-3 py-2.5 border-b last:border-b-0">
              <span className="text-sm text-muted-foreground shrink-0 w-5 text-center">
                {item.quantity}
              </span>
              <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
                <p className="text-sm font-medium truncate">{item.name}</p>
                {item.quantity > 1 && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    × {formatCurrency(item.unit_price, currency)}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium shrink-0">
                {formatCurrency(item.total_price, currency)}
              </p>
            </div>
          )
        )}

        {lineItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No items recorded.
          </p>
        )}
      </div>

      <Separator />

      {/* Totals */}
      <div className="space-y-2 text-sm">
        {totals?.subtotal != null && (
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal, currency)}</span>
          </div>
        )}
        {totals?.tax != null && totals.tax > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{formatCurrency(totals.tax, currency)}</span>
          </div>
        )}
        {totals?.gratuity != null && totals.gratuity > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Gratuity</span>
            <span>{formatCurrency(totals.gratuity, currency)}</span>
          </div>
        )}
        {totals?.fees != null && totals.fees > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Fees</span>
            <span>{formatCurrency(totals.fees, currency)}</span>
          </div>
        )}
        {totals?.discounts != null && totals.discounts > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Discounts</span>
            <span>−{formatCurrency(totals.discounts, currency)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold text-base">
          <span>Total</span>
          <span>{formatCurrency(totals?.total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
