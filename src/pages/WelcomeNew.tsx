import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

const WelcomeNew = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen page-background-hero flex flex-col overflow-y-auto scrollbar-hide">
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 py-12 lg:px-0">
        {/* Left Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />

        {/* Main Content */}
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo/Brand - Matching main Welcome page */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6">
              <span className="text-6xl">🌾</span>
            </div>
            <h1 className="page-title">
              <span className="text-primary">Ask</span>
              <span className="text-yellow-400">My</span>
              <span className="text-primary">Farm</span>
            </h1>
            <p className="page-subtitle mt-4">
              Connect your John Deere Operations Center to unlock AI-powered farm insights
            </p>
          </div>

          {/* Connect Button */}
          <div className="space-y-4 mt-12">
            <Button
              onClick={() => navigate("/connect/john-deere")}
              className="w-full h-14 text-base font-semibold"
              size="lg"
            >
              <span className="text-xl mr-2">🚜</span>
              Connect John Deere
            </Button>

            <p className="text-xs text-farm-muted text-center">
              Secure OAuth connection • Your data stays private
            </p>
          </div>

          {/* Skip Option */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate("/home")}
              className="text-sm text-farm-muted hover:text-primary transition-colors font-medium"
            >
              Skip for now
            </button>
          </div>

          {/* Footer text - inside content area on mobile */}
          <div className="text-center pt-6">
            <p className="text-xs text-farm-muted">
              You can also connect from Settings later
            </p>
          </div>
        </div>

        {/* Right Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />
      </main>
    </div>
  );
};

export default WelcomeNew;

