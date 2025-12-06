import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X, Tractor, ExternalLink, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { jdOnboardingAPI } from "@/lib/api";
import { toast } from "sonner";

const JohnDeereConnect = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    if (!user?.id) {
      toast.error("Please login first");
      navigate("/auth/login");
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Get OAuth URL from backend
      const response = await jdOnboardingAPI.getOAuthUrl();
      
      // Step 2: Redirect user to John Deere login
      // JD will redirect back to /api/v1/auth/jdops/callback
      // which will then redirect to frontend /auth/jdops/importing
      window.location.href = response.auth_url;
    } catch (error: any) {
      toast.error(error?.message || "Failed to start John Deere connection");
      setIsLoading(false);
    }
  };

  // Show explanation screen (only screen needed now - OAuth handles the rest)
  return (
      <div className="min-h-screen bg-farm-dark flex flex-col">
        <header className="flex items-center justify-between px-4 py-4 border-b">
          <button onClick={() => navigate("/settings")} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Connect John Deere</h2>
          <button onClick={() => navigate("/home")} className="p-2">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 px-6 py-8 overflow-y-auto scrollbar-hide">
          <div className="max-w-md mx-auto space-y-8 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-green-600 flex items-center justify-center">
                <Tractor className="w-9 h-9 text-white" />
              </div>
              <h1 className="page-title">John Deere Operations Center</h1>
            </div>

            <div className="space-y-4">
              <p className="body-text">
                We'll securely connect to your JD account to import:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-accent">
                  <span className="text-primary font-bold">✓</span>
                  <span>All field boundaries</span>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-accent">
                  <span className="text-primary font-bold">✓</span>
                  <span>Field names and acreage</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-farm-muted text-center">
                  Your data is encrypted and we never store your JD password.
                  <br />
                  You can disconnect at any time.
                </p>
              </div>
            </div>

            {/* Step 1: Grant Organization Access (if not already done) */}
            <div className="space-y-3 border border-farm-accent/20 rounded-lg p-4 bg-farm-card">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-farm-accent text-farm-dark text-sm font-bold">1</span>
                <h3 className="font-semibold text-farm-text">Grant Organization Access</h3>
              </div>
              <p className="text-sm text-farm-muted">
                First, if you have not already, grant AskMyFarm access to your John Deere organizations. If you have already granted access, skip to Step 2.
              </p>
              <Button
                onClick={() => {
                  window.open(
                    'https://connections.deere.com/connections/0oaqyaxtyhUjkNhmU5d7/select-organizations',
                    '_blank',
                    'noopener,noreferrer'
                  );
                }}
                variant="outline"
                className="w-full border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Grant Organization Access
                <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
              </Button>
            </div>

            {/* Step 2: Continue to John Deere */}
            <div className="space-y-3 border border-farm-accent/20 rounded-lg p-4 bg-farm-card">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-farm-accent text-farm-dark text-sm font-bold">2</span>
                <h3 className="font-semibold text-farm-text">Connect Your Account</h3>
              </div>
              <p className="text-sm text-farm-muted">
                After granting access, connect your John Deere account to import your fields.
              </p>
              <Button 
                onClick={handleConnect} 
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
              >
                {isLoading ? "Connecting..." : "Continue to John Deere"}
              </Button>
            </div>

            <button
              onClick={() => navigate("/settings")}
              disabled={isLoading}
              className="block text-center text-farm-muted hover:text-foreground transition-colors w-full disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </main>
      </div>
  );
};

export default JohnDeereConnect;
