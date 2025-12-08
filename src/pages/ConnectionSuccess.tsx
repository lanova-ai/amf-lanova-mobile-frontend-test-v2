import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { connectionAPI } from "@/lib/api";
import { toast } from "sonner";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

type Status = "importing" | "success" | "cancelled" | "error";

const ConnectionSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("importing");
  const [stats, setStats] = useState({ fields: 0, acres: 0, years: 5 });

  const provider = searchParams.get("provider") || "johndeere";
  const callbackStatus = searchParams.get("status");

  useEffect(() => {
    if (callbackStatus === "cancelled") {
      setStatus("cancelled");
      return;
    }

    if (callbackStatus === "error") {
      setStatus("error");
      return;
    }

    // Poll for import completion
    const pollInterval = setInterval(async () => {
      try {
        const response = await connectionAPI.getJohnDeereStatus();
        
        if (response.sync_status === "completed") {
          clearInterval(pollInterval);
          setStatus("success");
          toast.success("Fields imported successfully!");
          // TODO: Fetch actual stats from API
          setStats({ fields: 47, acres: 2458, years: 5 });
          
          // Auto-redirect after 3 seconds
          setTimeout(() => {
            navigate("/home");
          }, 3000);
        } else if (response.sync_status === "failed") {
          clearInterval(pollInterval);
          setStatus("error");
          toast.error("Import failed. Please try again.");
        }
      } catch (error) {
        console.error("Poll error:", error);
      }
    }, 3000);

    // Stop polling after 60 seconds
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (status === "importing") {
        setStatus("success"); // Assume success if still importing after 60s
        toast.success("Import is taking longer than usual. Check your fields in a moment.");
        
        // Auto-redirect after showing message
        setTimeout(() => {
          navigate("/home");
        }, 3000);
      }
    }, 60000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [callbackStatus, status]);

  // Cancelled state
  if (status === "cancelled") {
    return (
      <div className="min-h-screen bg-farm-dark flex lg:justify-center">
        <MobileFirstIndicator />
        <div className="flex-1 lg:flex-none lg:w-[512px] flex flex-col items-center justify-center px-6 lg:border-x lg:border-farm-accent/10">
          <div className="max-w-md w-full space-y-8 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
              <span className="text-4xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold">Connection Cancelled</h1>
            <p className="text-farm-muted">
              You can connect your {provider} account anytime from Settings.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/settings")} variant="outline" className="w-full">
                Go to Settings
              </Button>
              <Button onClick={() => navigate("/home")} className="w-full">
                Continue to App
              </Button>
            </div>
          </div>
        </div>
        <MobileFirstIndicator />
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="min-h-screen bg-farm-dark flex lg:justify-center">
        <MobileFirstIndicator />
        <div className="flex-1 lg:flex-none lg:w-[512px] flex flex-col items-center justify-center px-6 lg:border-x lg:border-farm-accent/10">
          <div className="max-w-md w-full space-y-8 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold">Connection Failed</h1>
            <p className="text-farm-muted">
              We couldn't import your fields. Please try again or contact support if the issue persists.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/connect/john-deere")} className="w-full">
                Try Again
              </Button>
              <Button onClick={() => navigate("/home")} variant="outline" className="w-full">
                Skip for Now
              </Button>
            </div>
          </div>
        </div>
        <MobileFirstIndicator />
      </div>
    );
  }

  // Importing state
  if (status === "importing") {
    return (
      <div className="min-h-screen bg-farm-dark flex lg:justify-center">
        <MobileFirstIndicator />
        <div className="flex-1 lg:flex-none lg:w-[512px] flex flex-col items-center justify-center px-6 lg:border-x lg:border-farm-accent/10">
          <div className="max-w-md w-full space-y-8 text-center animate-fade-in">
            <div>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4 relative">
                <span className="text-4xl">🚜</span>
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Importing Your Fields...</h1>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-accent">
                <span className="text-primary font-bold text-xl">✓</span>
                <span className="text-sm">Connected to {provider === "johndeere" ? "John Deere" : "Climate FieldView"}</span>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Fetching field boundaries...</span>
              </div>

              <div className="p-4 rounded-lg border-2 border-dashed">
                <div className="space-y-1">
                  <p className="font-semibold text-farm-muted">Importing...</p>
                  <p className="text-sm text-farm-muted">This may take 30-60 seconds</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <MobileFirstIndicator />
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-farm-dark flex lg:justify-center">
      <MobileFirstIndicator />
      <div className="flex-1 lg:flex-none lg:w-[512px] flex flex-col lg:border-x lg:border-farm-accent/10">
        <header className="flex items-center justify-between px-4 py-4 border-b">
          <div className="w-10" />
          <h2 className="text-lg font-semibold">Import Complete!</h2>
          <div className="w-10" />
        </header>

        <main className="flex-1 px-6 py-8 overflow-y-auto scrollbar-hide">
          <div className="max-w-md mx-auto space-y-8 animate-fade-in">
            <div className="text-center">
              <div className="icon-brand mb-4">
                <span className="icon-brand-emoji">✓</span>
              </div>
              <h1 className="page-title">Successfully imported:</h1>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-accent">
                  <div className="text-3xl font-bold text-primary">{stats.fields}</div>
                  <div className="text-sm text-farm-muted">Fields</div>
                </div>
                <div className="p-4 rounded-lg bg-accent">
                  <div className="text-3xl font-bold text-primary">{stats.acres.toLocaleString()}</div>
                  <div className="text-sm text-farm-muted">Acres</div>
                </div>
                <div className="p-4 rounded-lg bg-accent">
                  <div className="text-3xl font-bold text-primary">{stats.years}</div>
                  <div className="text-sm text-farm-muted">Years</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-center text-sm text-farm-muted">
                Your fields are now available in AskMyFarm
              </p>
              <p className="text-center text-xs text-farm-muted">
                Redirecting to home in a moment...
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => navigate("/home")}
                className="w-full h-12 text-base font-semibold"
              >
                Continue to App Now
              </Button>
            </div>
          </div>
        </main>
      </div>
      <MobileFirstIndicator />
    </div>
  );
};

export default ConnectionSuccess;

