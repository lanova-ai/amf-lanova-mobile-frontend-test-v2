import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { jdOnboardingAPI } from "@/lib/api";
import { toast } from "sonner";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

const JDImporting = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"importing" | "success" | "error">("importing");
  const [stats, setStats] = useState({ fields: 0, acres: 0 });

  useEffect(() => {
    let pollCount = 0;
    const MAX_POLL_ATTEMPTS = 20; // Stop after 20 failed polls
    
    // Poll for import completion
    const pollInterval = setInterval(async () => {
      try {
        const response = await jdOnboardingAPI.getImportStatus();
        
        // Reset poll count on successful response
        pollCount = 0;
        
        if (response.sync_status === "completed") {
          clearInterval(pollInterval);
          setStatus("success");
          setStats({
            fields: response.fields_imported || 0,
            acres: response.total_acres || 0
          });
          toast.success("Fields imported successfully!");
        } else if (response.sync_status === "failed") {
          clearInterval(pollInterval);
          setStatus("error");
          toast.error("Import failed. Please try again.");
        }
      } catch (error: any) {
        pollCount++;
        console.error(`Poll error (attempt ${pollCount}):`, error);
        
        // If we get too many consecutive errors, stop polling
        if (pollCount >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          console.warn("Stopped polling due to too many errors");
        }
        
        // Only show toast for non-auth errors to avoid spam
        if (error?.status !== 401 && error?.status !== 403 && pollCount === 1) {
          toast.error("Connection issue. Retrying...");
        }
      }
    }, 3000);

    // Stop polling after 60 seconds
    const timeout = setTimeout(async () => {
      clearInterval(pollInterval);
      if (status === "importing") {
        // Fetch final status before showing success
        try {
          const response = await jdOnboardingAPI.getImportStatus();
          setStats({
            fields: response.fields_imported || 0,
            acres: response.total_acres || 0
          });
          setStatus("success");
          toast.success("Fields imported successfully!");
        } catch (error) {
          console.error("Final status fetch error:", error);
          setStatus("success");
          toast.success("Import is taking longer than usual. Check your fields in a moment.");
        }
      }
    }, 60000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [status]);

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
            <h1 className="text-2xl font-bold">Import Failed</h1>
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

  // Success state
  if (status === "success") {
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-accent">
                    <div className="text-3xl font-bold text-primary">{stats.fields}</div>
                    <div className="text-sm text-farm-muted">Fields</div>
                  </div>
                  <div className="p-4 rounded-lg bg-accent">
                    <div className="text-3xl font-bold text-primary">{stats.acres.toLocaleString()}</div>
                    <div className="text-sm text-farm-muted">Acres</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-center text-sm text-farm-muted">
                  Your fields are now available in AskMyFarm
                </p>
              </div>

              <div className="space-y-3">
                <Button variant="outline" className="w-full h-12 text-base font-semibold">
                  View on Map
                </Button>
                <Button
                  onClick={() => navigate("/home")}
                  className="w-full h-12 text-base font-semibold"
                >
                  Continue to App
                </Button>
              </div>
            </div>
          </main>
        </div>
        <MobileFirstIndicator />
      </div>
    );
  }

  // Importing state (default)
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
              <span className="text-sm">Connected to John Deere</span>
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
};

export default JDImporting;

