import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/hooks/use-transactions";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  trend?: string;
  trendColor?: "green" | "red" | "neutral";
  colorClass?: string;
  isLoading?: boolean;
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendColor = "neutral",
  colorClass = "text-primary",
  isLoading 
}: StatsCardProps) {
  return (
    <div className="relative overflow-hidden bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
        <div className={cn("p-2.5 rounded-xl bg-background/50 group-hover:scale-110 transition-transform duration-300", colorClass.replace("text-", "bg-").replace("500", "500/10").replace("600", "600/10"))}>
          <Icon className={cn("w-5 h-5", colorClass)} />
        </div>
      </div>
      
      <div className="space-y-1">
        {isLoading ? (
          <div className="h-8 w-32 bg-secondary animate-pulse rounded-lg" />
        ) : (
          <div className="text-3xl font-display font-bold tracking-tight text-foreground">
            {formatCurrency(value)}
          </div>
        )}
        
        {trend && (
          <p className={cn("text-xs font-medium flex items-center mt-2", 
            trendColor === "green" && "text-emerald-500",
            trendColor === "red" && "text-rose-500",
            trendColor === "neutral" && "text-muted-foreground"
          )}>
            {trend}
          </p>
        )}
      </div>

      {/* Decorative background gradient */}
      <div className={cn("absolute -bottom-6 -right-6 w-24 h-24 rounded-full blur-3xl opacity-10 pointer-events-none", colorClass.replace("text-", "bg-"))} />
    </div>
  );
}
