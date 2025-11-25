import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const demoScreens = [
  { name: "Welcome", path: "/" },
  { name: "Login", path: "/auth/login" },
  { name: "Phone Auth", path: "/auth/phone" },
  { name: "Welcome New User", path: "/welcome-new" },
  { name: "John Deere Connect", path: "/connect/john-deere" },
  { name: "Home Feed", path: "/home" },
  { name: "Voice Capture", path: "/voice-capture" },
  { name: "Field Observation", path: "/field-observation" },
  { name: "Tasks", path: "/tasks" },
  { name: "Field Plan", path: "/field-plan" },
];

export const DemoNav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Demo Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full bg-secondary text-secondary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <Eye className="h-5 w-5" />
      </button>

      {/* Demo Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-20 right-4 bg-card rounded-2xl p-4 space-y-2 z-50 animate-slide-up shadow-xl border min-w-[250px]">
            <div className="flex items-center justify-between mb-3 pb-3 border-b">
              <h3 className="font-semibold text-sm">Demo Navigation</h3>
              <button onClick={() => setIsOpen(false)} className="p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {demoScreens.map((screen) => (
              <Button
                key={screen.path}
                onClick={() => handleNavigate(screen.path)}
                variant="ghost"
                className="w-full justify-start text-sm font-medium h-10"
              >
                {screen.name}
              </Button>
            ))}
          </div>
        </>
      )}
    </>
  );
};
