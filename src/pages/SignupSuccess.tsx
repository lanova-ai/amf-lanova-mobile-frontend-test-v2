import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

export default function SignupSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const firstName = searchParams.get("name") || "";

  return (
    <div className="min-h-screen page-background flex flex-col overflow-y-auto scrollbar-hide">
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 py-12 lg:px-0">
        {/* Left Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />

        {/* Main Content */}
        <div className="w-full max-w-md text-center">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-farm-accent/20">
              <CheckCircle2 className="h-12 w-12 text-farm-accent" />
            </div>
          </div>

          {/* Logo */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">
              <span className="text-primary">Ask</span>
              <span className="text-farm-gold">My</span>
              <span className="text-primary">Farm</span>
            </h2>
          </div>

          {/* Welcome Message */}
          <h1 className="text-2xl font-bold text-farm-text mb-3">
            Welcome to AskMyFarm!
          </h1>
          
          <p className="text-farm-muted mb-8">
            {firstName ? `Hi ${firstName}, your` : "Your"} account has been created successfully.
          </p>

          {/* Continue Button */}
          <Button
            onClick={() => navigate("/auth/login")}
            className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
            size="lg"
          >
            Continue to Login
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          {/* Founding Farmer Note */}
          <p className="text-xs text-farm-muted mt-8">
            As a Founding Farmer, you'll enjoy exclusive early access to all features.
          </p>
        </div>

        {/* Right Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />
      </main>
    </div>
  );
}

