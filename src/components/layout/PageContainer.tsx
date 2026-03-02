import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main className={cn("px-4 py-4 pb-24 max-w-2xl mx-auto", className)}>
      {children}
    </main>
  );
}
