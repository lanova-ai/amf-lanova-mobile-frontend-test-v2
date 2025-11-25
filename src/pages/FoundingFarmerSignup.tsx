import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { authAPI } from "@/lib/api";
import { toast } from "sonner";

export default function FoundingFarmerSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const approvalCode = searchParams.get("code") || "";
  
  const [formData, setFormData] = useState({
    email: "",
    phoneNumber: "",
    firstName: "",
    lastName: "",
    farmName: "",
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Show invalid link page if no approval code
  if (!approvalCode) {
    return (
      <div className="min-h-screen page-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-destructive/10 rounded-full mb-6">
            <span className="text-5xl">⚠️</span>
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-3">Invalid Sign-Up Link</h1>
          
          <p className="text-sm text-farm-muted mb-6">
            This sign-up link is invalid or has expired. Please use the link from your approval email.
          </p>
          
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Password validation helper
  const validatePassword = (pwd: string): string | null => {
    if (!pwd) return null; // Password is optional
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Must include at least one uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Must include at least one lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Must include at least one number";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.email || !formData.phoneNumber || !formData.firstName || !formData.lastName || !formData.farmName) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate phone number
    if (formData.phoneNumber.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    // Validate password if provided
    if (formData.password) {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        toast.error(passwordError);
        return;
      }
      
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Call the new simplified sign-up endpoint
      await authAPI.foundingFarmerSignup({
        approval_code: approvalCode,
        email: formData.email,
        phone_number: formData.phoneNumber,
        first_name: formData.firstName,
        last_name: formData.lastName,
        farm_name: formData.farmName,
        password: formData.password || undefined,
      });

      toast.success("Account created successfully! Please log in to continue.");
      
      // Redirect to login page
      navigate("/auth/login");
    } catch (error: any) {
      const errorMessage = error?.details?.detail || error?.message || "Sign-up failed. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen page-background flex items-start justify-center p-6 pt-12">
      <div className="max-w-md w-full">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
            <span className="text-5xl">🌾</span>
          </div>
          <h2 className="text-xl font-semibold mb-6">
            <span className="text-primary">Ask</span>
            <span className="text-yellow-400">My</span>
            <span className="text-primary">Farm</span>
          </h2>
          
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-3">
            Complete Your Sign-Up
          </h1>
          <p className="text-sm text-farm-muted">
            You've been approved! Fill out the form below to create your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isSubmitting}
              className="bg-card border-border"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="1234567890"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              required
              disabled={isSubmitting}
              className="bg-card border-border"
            />
            <p className="text-xs text-farm-muted">10-digit US phone number</p>
          </div>

          {/* First Name */}
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-foreground">First Name *</Label>
            <Input
              id="firstName"
              type="text"
              placeholder="John"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              disabled={isSubmitting}
              className="bg-card border-border"
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-foreground">Last Name *</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              disabled={isSubmitting}
              className="bg-card border-border"
            />
          </div>

          {/* Farm Name */}
          <div className="space-y-2">
            <Label htmlFor="farmName" className="text-foreground">Farm Name *</Label>
            <Input
              id="farmName"
              type="text"
              placeholder="Green Acres Farm"
              value={formData.farmName}
              onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
              required
              disabled={isSubmitting}
              className="bg-card border-border"
            />
          </div>

          {/* Password (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              Password <span className="text-farm-muted text-xs">(optional)</span>
            </Label>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password (optional)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={isSubmitting}
              className="bg-card border-border"
            />
            {formData.password && (
              <>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={isSubmitting}
                  className="bg-card border-border mt-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-primary hover:underline"
                >
                  {showPassword ? "Hide" : "Show"} password
                </button>
              </>
            )}
            <p className="text-xs text-farm-muted">
              Min 8 characters, with uppercase, lowercase, and number
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark mt-8"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

