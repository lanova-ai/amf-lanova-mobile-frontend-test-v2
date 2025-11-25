import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/**
 * Page - Root container for all pages
 * Provides consistent background and layout structure
 */
interface PageProps {
  children: React.ReactNode;
  className?: string;
}

export function Page({ children, className }: PageProps) {
  return (
    <div className={cn("flex flex-col min-h-screen bg-farm-dark", className)}>
      {children}
    </div>
  );
}

/**
 * PageHeader - Sticky header with back button, title, and optional action
 */
interface PageHeaderProps {
  title: string;
  backTo?: string;
  onBack?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, backTo, onBack, action, className }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else if (window.history.length > 1) {
      navigate(-1);
    }
  };

  return (
    <header className={cn("sticky top-0 z-40 bg-farm-dark border-b border-farm-accent/20", className)}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {(backTo || onBack) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-xl font-semibold text-farm-text">{title}</h1>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}

/**
 * PageContent - Main content area with consistent padding and spacing
 */
interface PageContentProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageContent({ children, className, noPadding = false }: PageContentProps) {
  return (
    <main className={cn(
      "flex-1 overflow-y-auto scrollbar-hide",
      !noPadding && "p-4 space-y-6",
      className
    )}>
      {children}
      {/* Bottom padding for mobile FAB/nav */}
      <div className="pb-20" />
    </main>
  );
}

/**
 * PageLoading - Centered loading state for pages
 */
interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-farm-dark gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-farm-accent border-t-transparent" />
      {message && <p className="text-sm text-farm-muted">{message}</p>}
    </div>
  );
}

