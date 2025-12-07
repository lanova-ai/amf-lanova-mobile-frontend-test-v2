import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { userAPI } from "@/lib/api";
import {
  Page,
  PageHeader,
  PageContent,
  Section,
  Button,
  Input,
  Label,
  LoadingButton
} from "@/components/ui";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [errors, setErrors] = useState<{
    current_password?: string;
    new_password?: string;
    confirm_password?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.current_password) {
      newErrors.current_password = "Current password is required";
    }

    if (!formData.new_password) {
      newErrors.new_password = "New password is required";
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
      newErrors.confirm_password = "Please confirm your new password";
    } else if (formData.new_password !== formData.confirm_password) {
      newErrors.confirm_password = "Passwords do not match";
    }

    if (formData.current_password && formData.new_password && formData.current_password === formData.new_password) {
      newErrors.new_password = "New password must be different from current password";
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
      await userAPI.changePassword({
        current_password: formData.current_password,
        new_password: formData.new_password,
      });

      toast.success("Password changed successfully");
      navigate("/settings");
    } catch (error: any) {
      console.error("Failed to change password:", error);
      
      // Handle specific error messages
      if (error.status === 401) {
        setErrors({ current_password: error.message || "Current password is incorrect" });
        toast.error("Current password is incorrect");
      } else if (error.status === 400) {
        const errorMessage = error.message || "Invalid password";
        if (errorMessage.includes("different")) {
          setErrors({ new_password: errorMessage });
        } else if (errorMessage.includes("No password set")) {
          toast.error("No password set for this account. Please set a password first.");
          navigate("/settings");
        } else {
          setErrors({ new_password: errorMessage });
        }
        toast.error(errorMessage);
      } else {
        toast.error(error.message || "Failed to change password");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Change Password" backTo="/settings" />

      <PageContent>
        <div className="max-w-md mx-auto space-y-6">
          {/* Info Card */}
          <Section>
            <div className="flex items-start gap-3">
              <Lock className="h-6 w-6 text-farm-accent flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-farm-text">Password Requirements</h3>
                <ul className="text-sm text-farm-muted space-y-1">
                  <li>• At least 8 characters</li>
                  <li>• One uppercase letter</li>
                  <li>• One lowercase letter</li>
                  <li>• One number</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current_password"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter your current password"
                  value={formData.current_password}
                  onChange={(e) => {
                    setFormData({ ...formData, current_password: e.target.value });
                    if (errors.current_password) {
                      setErrors({ ...errors, current_password: undefined });
                    }
                  }}
                  className={errors.current_password ? "border-destructive" : ""}
                  disabled={saving}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.current_password && (
                <p className="text-sm text-destructive">{errors.current_password}</p>
              )}
            </div>

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
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.new_password && (
                <p className="text-sm text-destructive">{errors.new_password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
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
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.confirm_password && (
                <p className="text-sm text-destructive">{errors.confirm_password}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
                size="lg"
                disabled={saving}
              >
                <LoadingButton loading={saving} loadingText="Changing Password...">
                  Change Password
                </LoadingButton>
              </Button>
            </div>
          </form>
        </div>
      </PageContent>
    </Page>
  );
}

