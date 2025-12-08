import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { userAPI } from "@/lib/api";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

export default function SetPassword() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    new_password: "",
    confirm_password: "",
  });
  const [errors, setErrors] = useState<{
    new_password?: string;
    confirm_password?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.new_password) {
      newErrors.new_password = "Password is required";
    } else {
      if (formData.new_password.length < 8) {
        newErrors.new_password = "Password must be at least 8 characters";
      } else if (!/[A-Z]/.test(formData.new_password)) {
        newErrors.new_password = "Password must contain at least one uppercase letter";
      } else if (!/[a-z]/.test(formData.new_password)) {
        newErrors.new_password = "Password must contain at least one lowercase letter";
      } else if (!/\d/.test(formData.new_password)) {
        newErrors.new_password = "Password must contain at least one number";
      }
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = "Please confirm your password";
    } else if (formData.new_password !== formData.confirm_password) {
      newErrors.confirm_password = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      await userAPI.setPassword({
        new_password: formData.new_password,
      });

      toast.success("Password set successfully");
      navigate("/home");
    } catch (error: any) {
      console.error("Failed to set password:", error);
      toast.error(error.message || "Failed to set password");
      if (error.message?.includes("strength")) {
        setErrors({ new_password: error.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigate("/home");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Set Password</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-start lg:items-center justify-center p-6 overflow-y-auto scrollbar-hide lg:px-0">
        {/* Left Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />

        {/* Main Content */}
        <div className="w-full max-w-md mx-auto lg:mx-0 space-y-6">
          {/* Info Card */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Set a Password</h3>
                <p className="text-sm text-farm-muted">
                  Set a password for easier login next time. You can skip this and continue using verification codes.
                </p>
              </div>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-2">Password Requirements</h4>
            <ul className="text-sm text-farm-muted space-y-1">
              <li>• At least 8 characters</li>
              <li>• One uppercase letter</li>
              <li>• One lowercase letter</li>
              <li>• One number</li>
            </ul>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={formData.new_password}
                  onChange={(e) => {
                    setFormData({ ...formData, new_password: e.target.value });
                    if (errors.new_password) {
                      setErrors({ ...errors, new_password: undefined });
                    }
                    // Clear confirm password error if passwords match
                    if (errors.confirm_password && e.target.value === formData.confirm_password) {
                      setErrors({ ...errors, confirm_password: undefined });
                    }
                  }}
                  className={errors.new_password ? "border-destructive" : ""}
                  disabled={saving}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-farm-muted" />
                  ) : (
                    <Eye className="h-4 w-4 text-farm-muted" />
                  )}
                </Button>
              </div>
              {errors.new_password && (
                <p className="text-sm text-destructive">{errors.new_password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={formData.confirm_password}
                  onChange={(e) => {
                    setFormData({ ...formData, confirm_password: e.target.value });
                    if (errors.confirm_password) {
                      setErrors({ ...errors, confirm_password: undefined });
                    }
                  }}
                  className={errors.confirm_password ? "border-destructive" : ""}
                  disabled={saving}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-farm-muted" />
                  ) : (
                    <Eye className="h-4 w-4 text-farm-muted" />
                  )}
                </Button>
              </div>
              {errors.confirm_password && (
                <p className="text-sm text-destructive">{errors.confirm_password}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4 space-y-3">
              <Button
                type="submit"
                className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                size="lg"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  "Set Password"
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSkip}
                disabled={saving}
              >
                Skip for Now
              </Button>
            </div>
          </form>
        </div>

        {/* Right Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />
      </main>
    </div>
  );
}

