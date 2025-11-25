import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LoadingSpinner - Themed loading spinner
 */
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  return (
    <Loader2 className={cn("animate-spin text-farm-accent", sizeClasses[size], className)} />
  );
}

/**
 * LoadingOverlay - Full-screen loading overlay
 */
interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-farm-dark/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-farm-card rounded-lg border border-farm-accent/20 p-6 flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        {message && <p className="text-sm text-farm-text">{message}</p>}
      </div>
    </div>
  );
}

/**
 * LoadingButton - Button with inline loading state
 */
interface LoadingButtonProps {
  loading: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

export function LoadingButton({ loading, children, loadingText = "Loading..." }: LoadingButtonProps) {
  if (loading) {
    return (
      <>
        <LoadingSpinner size="sm" className="mr-2" />
        {loadingText}
      </>
    );
  }
  return <>{children}</>;
}

