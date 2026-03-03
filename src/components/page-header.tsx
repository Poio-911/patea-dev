import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
};

export function PageHeader({ title, description, children, className, icon }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {/* Accent bar */}
        <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-primary to-primary/30 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-primary shrink-0">{icon}</span>}
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
          </div>
          {description && (
            <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {description}
            </div>
          )}
        </div>
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2 md:mt-1">
          {children}
        </div>
      )}
    </div>
  );
}
