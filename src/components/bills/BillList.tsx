import { BillCard } from "./BillCard";
import type { Bill, BillTotal } from "@/types/database";

interface BillListProps {
  bills: (Bill & { bill_totals: BillTotal | null; owner_display_name?: string })[];
  currentUserId?: string;
}

export function BillList({ bills, currentUserId }: BillListProps) {
  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
        <p className="text-lg font-medium text-muted-foreground">No bills yet</p>
        <p className="text-sm text-muted-foreground">
          Tap the + button below to create your first bill
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bills.map((bill) => (
        <BillCard
          key={bill.id}
          bill={bill}
          total={bill.bill_totals}
          isOwner={currentUserId ? bill.owner_id === currentUserId : true}
          ownerName={bill.owner_display_name}
        />
      ))}
    </div>
  );
}
