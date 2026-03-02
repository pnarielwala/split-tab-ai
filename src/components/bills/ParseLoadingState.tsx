import { Skeleton } from "@/components/ui/skeleton";

export function ParseLoadingState() {
  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
          <span className="text-2xl animate-bounce">🧾</span>
        </div>
        <p className="font-semibold">AI is reading your receipt...</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          This may take 10–30 seconds. The AI model analyzes your receipt image to extract all items and totals.
        </p>
      </div>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t">
        {["Subtotal", "Tax", "Total"].map((label) => (
          <div key={label} className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
