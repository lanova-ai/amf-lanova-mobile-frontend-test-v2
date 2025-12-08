import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Mic, Share2, Tractor } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

const Welcome = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if already logged in
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/home", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen page-background-hero flex flex-col overflow-y-auto scrollbar-hide">
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 py-12 lg:px-0">
        {/* Left Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />

        {/* Main Content */}
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo/Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6">
              <span className="text-6xl">🌾</span>
            </div>
            <h1 className="page-title">
              <span className="text-primary">Ask</span>
              <span className="text-farm-gold">My</span>
              <span className="text-primary">Farm</span>
            </h1>
            <p className="page-subtitle mt-4 mb-12">
              Your farm's digital memory. Plan smarter, collaborate better, execute seamlessly.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center mb-12 space-y-4">
            <div className="flex gap-3 w-full max-w-sm">
              <Button
                onClick={() => navigate("/auth/login")}
                className="flex-1 h-12 text-sm font-semibold bg-transparent hover:bg-farm-card text-farm-text border border-farm-text"
                size="lg"
              >
                Log In
              </Button>
              <Button
                onClick={() => navigate("/founding-farmers/apply")}
                className="flex-1 h-12 text-sm font-semibold bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                size="lg"
              >
                Join Program
              </Button>
            </div>
            
            {/* Token sign-up link */}
            <button
              onClick={() => navigate("/founding-farmers/signup")}
              className="text-sm text-farm-muted hover:text-farm-accent transition-colors"
            >
              Already have a token? <span className="underline">Sign Up</span>
            </button>
          </div>

          {/* Feature Highlights - Cards */}
          <div className="space-y-3">
            <div className="card-feature">
              <div className="icon-small">
                <Mic className="icon-small-svg" />
              </div>
              <div>
                <h3 className="card-title">Talk: Voice-First Input</h3>
                <p className="text-muted-foreground text-xs">Capture observations, notes, and plans while walking your fields</p>
              </div>
            </div>
            
            <div className="card-feature">
              <div className="icon-small">
                <Share2 className="icon-small-svg" />
              </div>
              <div>
                <h3 className="card-title">Share: Seamless Collaboration</h3>
                <p className="text-muted-foreground text-xs">Connect with agronomists, contractors, and advisors instantly</p>
              </div>
            </div>
            
            <div className="card-feature">
              <div className="icon-small">
                <Tractor className="icon-small-svg" />
              </div>
              <div>
                <h3 className="card-title">Execute: Smart Operations</h3>
                <p className="text-muted-foreground text-xs">AI-powered field plans and real-time operations tracking</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />
      </main>

      {/* Footer */}
      <footer className="pb-6 px-6 text-center">
        <p className="text-xs text-muted-foreground mb-2">
          By continuing, you agree to our{' '}
          <button
            onClick={() => navigate('/terms')}
            className="text-primary underline hover:text-primary/80"
          >
            Terms
          </button>
          {' '}&{' '}
          <button
            onClick={() => navigate('/privacy')}
            className="text-primary underline hover:text-primary/80"
          >
            Privacy Policy
          </button>
        </p>
      </footer>
    </div>
  );
};

export default Welcome;
