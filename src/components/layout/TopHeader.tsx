import { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopHeaderProps {
  title?: string;
  backHref?: string;
  backButton?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function TopHeader({ title, backHref, backButton, actions, className }: TopHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4",
        className
      )}
    >
      {backButton}
      {!backButton && backHref && (
        <Link
          href={backHref}
          className="mr-2 -ml-2 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      {title && <h1 className="flex-1 font-semibold truncate">{title}</h1>}
      {!title && <div className="flex-1" />}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
