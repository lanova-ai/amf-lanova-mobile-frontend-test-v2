import React from "react";
import { cn } from "@/lib/utils";

/**
 * ListItem - Themed card for list items
 */
interface ListItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ListItem({ children, onClick, className }: ListItemProps) {
  const Component = onClick ? "button" : "div";
  
  return (
    <Component
      onClick={onClick}
      className={cn(
        "bg-farm-card rounded-lg border border-farm-accent/20 p-4 w-full text-left",
        onClick && "hover:bg-farm-accent/5 transition-colors cursor-pointer",
        className
      )}
    >
      {children}
    </Component>
  );
}

/**
 * ListContainer - Container for list items with consistent spacing
 */
interface ListContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ListContainer({ children, className }: ListContainerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}

