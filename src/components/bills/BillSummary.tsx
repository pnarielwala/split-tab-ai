import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { LineItem, BillTotal } from "@/types/database";

interface BillSummaryProps {
  lineItems: LineItem[];
  totals: BillTotal | null;
}

export function BillSummary({ lineItems, totals }: BillSummaryProps) {
  const currency = totals?.currency ?? "USD";

  return (
    <div className="space-y-4">
      {/* Line items */}
      <div className="space-y-0">
        {lineItems.map((item) => (
          <div key={item.id} className="flex items-start justify-between py-2.5 border-b last:border-b-0">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-medium">{item.name}</p>
              {item.quantity !== 1 && (
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatCurrency(item.unit_price, currency)}
                </p>
              )}
            </div>
            <p className="text-sm font-medium shrink-0">
              {formatCurrency(item.total_price, currency)}
            </p>
          </div>
        ))}

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
        <Separator />
        <div className="flex justify-between font-semibold text-base">
          <span>Total</span>
          <span>{formatCurrency(totals?.total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
