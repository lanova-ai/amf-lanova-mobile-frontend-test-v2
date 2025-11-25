import React from "react";
import { cn } from "@/lib/utils";

/**
 * Section - Themed card wrapper for grouping related content
 * Replaces manual card styling with consistent theme
 */
interface SectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function Section({ title, description, children, className, headerAction }: SectionProps) {
  return (
    <div className={cn("bg-farm-card rounded-lg border border-farm-accent/20 p-4", className)}>
      {(title || description || headerAction) && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            {title && <h2 className="font-semibold text-lg text-farm-text">{title}</h2>}
            {headerAction && <div>{headerAction}</div>}
          </div>
          {description && <p className="text-sm text-farm-muted mt-1">{description}</p>}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

/**
 * SectionGroup - Container for multiple sections with consistent spacing
 */
interface SectionGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionGroup({ children, className }: SectionGroupProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {children}
    </div>
  );
}

