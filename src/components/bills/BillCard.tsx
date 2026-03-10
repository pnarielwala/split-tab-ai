import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Bill, BillTotal } from "@/types/database";
import { ChevronRight } from "lucide-react";
import { DeleteBillButton } from "@/components/bills/DeleteBillButton";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  uploaded: { label: "Processing", variant: "secondary" },
  parsed: { label: "Review needed", variant: "default" },
  verified: { label: "Done", variant: "secondary" },
};

interface BillCardProps {
  bill: Bill;
  total?: BillTotal | null;
  isOwner?: boolean;
}

export function BillCard({ bill, total, isOwner = true }: BillCardProps) {
  const status = statusLabels[bill.status] ?? statusLabels.draft;
  const href =
    bill.status === "draft"
      ? `/bills/${bill.id}/upload`
      : bill.status === "parsed"
      ? `/bills/${bill.id}/verify`
      : `/bills/${bill.id}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-center p-0">
        <Link href={href} className="flex-1 min-w-0 flex items-center gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{bill.name}</p>
              {bill.status !== "verified" && (
                <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(bill.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bill.status === "verified" && total?.total != null && (
              <span className="text-sm font-medium">{formatCurrency(total.total, total.currency)}</span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
        {isOwner && (
          <div className="pr-2 shrink-0">
            <DeleteBillButton billId={bill.id} billName={bill.name} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
