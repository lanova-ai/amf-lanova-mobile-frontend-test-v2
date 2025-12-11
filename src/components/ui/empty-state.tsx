import { LucideIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/**
 * EmptyState - Consistent empty state component
 */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12", className)}>
      <Icon className="h-12 w-12 mx-auto text-farm-muted mb-3" />
      <h3 className="font-semibold text-lg text-farm-text mb-1">{title}</h3>
      <p className="text-sm text-farm-muted mb-4">{description}</p>
      {action && (
        <Button 
          onClick={action.onClick}
          className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
        >
          {action.icon && <action.icon className="h-4 w-4 mr-2" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

