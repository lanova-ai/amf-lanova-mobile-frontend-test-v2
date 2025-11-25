import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console and error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send to error reporting service (e.g., Sentry, LogRocket)
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = "/home";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-farm-dark flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-farm-card border-farm-accent/20">
            <div className="flex items-center gap-3 text-farm-accent">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-semibold text-farm-text">Something went wrong</h2>
            </div>
            
            <p className="text-farm-muted text-sm">
              An unexpected error occurred. This has been logged and we'll look into it.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 p-3 bg-farm-dark rounded border border-farm-accent/20">
                <summary className="text-sm text-farm-muted cursor-pointer mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-xs text-red-400 overflow-auto max-h-48">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex-1 border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoHome}
                className="flex-1 bg-farm-accent text-white hover:bg-farm-accent/90"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

