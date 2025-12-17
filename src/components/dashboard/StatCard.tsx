import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

const variantStyles = {
  default: "bg-card",
  primary: "gradient-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
};

export function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const isPrimary = variant !== 'default';

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl p-6 shadow-card transition-all duration-300 hover:shadow-elevated",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn(
            "text-sm font-medium",
            isPrimary ? "text-current/80" : "text-muted-foreground"
          )}>
            {title}
          </p>
          <p className={cn(
            "mt-2 font-display text-3xl font-bold",
            isPrimary ? "text-current" : "text-foreground"
          )}>
            {value}
          </p>
          {trend && (
            <p className={cn(
              "mt-2 text-xs",
              isPrimary ? "text-current/70" : "text-muted-foreground"
            )}>
              <span className={trend.value >= 0 ? "text-success" : "text-destructive"}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>{' '}
              {trend.label}
            </p>
          )}
        </div>
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg",
          isPrimary ? "bg-current/20" : "bg-primary/10"
        )}>
          <Icon className={cn(
            "h-6 w-6",
            isPrimary ? "text-current" : "text-primary"
          )} />
        </div>
      </div>
    </div>
  );
}
