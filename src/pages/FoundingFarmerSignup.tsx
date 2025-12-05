import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { authAPI, foundingFarmerAPI } from "@/lib/api";
import { toast } from "sonner";

export default function FoundingFarmerSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";
  
  // Step management: "token" -> "form"
  const [step, setStep] = useState<"token" | "form">(codeFromUrl ? "form" : "token");
  const [approvalCode, setApprovalCode] = useState(codeFromUrl);
  const [tokenInput, setTokenInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validatedEmail, setValidatedEmail] = useState("");
  
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

  // If code from URL, validate it on mount
  useEffect(() => {
    if (codeFromUrl) {
      validateToken(codeFromUrl);
    }
  }, [codeFromUrl]);

  // Validate token and get associated email
  const validateToken = async (code: string) => {
    setIsValidating(true);
    try {
      const result = await foundingFarmerAPI.lookupCode(code);
      if (result.valid && result.email) {
        setApprovalCode(code);
        setValidatedEmail(result.email);
        setFormData(prev => ({ ...prev, email: result.email }));
        setStep("form");
        if (!codeFromUrl) {
          toast.success("Token verified! Complete your sign-up below.");
        }
      } else {
        toast.error(result.message || "Invalid or expired token");
        setStep("token");
      }
    } catch (error: any) {
      const msg = error?.details?.detail || error?.message || "Invalid or expired token";
      toast.error(msg);
      setStep("token");
    } finally {
      setIsValidating(false);
    }
  };

  // Handle token submission
  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim().toUpperCase();
    if (!cleanToken) {
      toast.error("Please enter your approval token");
      return;
    }
    validateToken(cleanToken);
  };

  // Password validation helper
  const validatePassword = (pwd: string): string | null => {
    if (!pwd) return null;
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Must include at least one uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Must include at least one lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Must include at least one number";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.phoneNumber || !formData.firstName || !formData.lastName || !formData.farmName) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.phoneNumber.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

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
      navigate("/auth/login");
    } catch (error: any) {
      const errorMessage = error?.details?.detail || error?.message || "Sign-up failed. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== TOKEN ENTRY STEP =====
  if (step === "token") {
    return (
      <div className="min-h-screen page-background flex items-center justify-center p-6">
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
            <h2 className="text-xl font-semibold mb-4">
              <span className="text-primary">Ask</span>
              <span className="text-yellow-400">My</span>
              <span className="text-primary">Farm</span>
            </h2>
            
            <h1 className="text-2xl font-bold text-primary mb-3">
              Enter Your Token
            </h1>
            <p className="text-sm text-farm-muted">
              Enter the approval token from your email to continue sign-up.
            </p>
          </div>

          <form onSubmit={handleTokenSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="token" className="text-foreground">Approval Token</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-farm-muted" />
                <Input
                  id="token"
                  type="text"
                  placeholder="AMF-XXXX"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  disabled={isValidating}
                  className="bg-card border-border pl-10 text-center text-lg font-mono tracking-widest uppercase"
                  maxLength={10}
                  autoFocus
                />
              </div>
              <p className="text-xs text-farm-muted text-center">
                Check your approval email for the token (e.g., AMF-K7X3)
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
              size="lg"
              disabled={isValidating || !tokenInput.trim()}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>

          <p className="text-xs text-farm-muted text-center mt-6">
            Don't have a token?{" "}
            <button
              onClick={() => navigate("/founding-farmers/apply")}
              className="text-farm-accent hover:underline"
            >
              Apply for the program
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ===== SIGNUP FORM STEP =====
  return (
    <div className="min-h-screen page-background flex items-start justify-center p-6 pt-8">
      <div className="max-w-md w-full">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => {
            if (codeFromUrl) {
              navigate("/");
            } else {
              setStep("token");
            }
          }}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3">
            <span className="text-4xl">🌾</span>
          </div>
          <h2 className="text-lg font-semibold mb-4">
            <span className="text-primary">Ask</span>
            <span className="text-yellow-400">My</span>
            <span className="text-primary">Farm</span>
          </h2>
          
          {/* Verified badge */}
          <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-1.5 rounded-full text-sm mb-4">
            <CheckCircle2 className="h-4 w-4" />
            Token Verified
          </div>
          
          <h1 className="text-xl font-bold text-primary mb-2">
            Complete Your Sign-Up
          </h1>
          <p className="text-sm text-farm-muted">
            Fill out the form below to create your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email - Pre-filled and read-only if validated */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-foreground text-sm">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isSubmitting || !!validatedEmail}
              className={`bg-card border-border ${validatedEmail ? 'opacity-70' : ''}`}
            />
            {validatedEmail && (
              <p className="text-xs text-farm-muted">Email verified from your approval</p>
            )}
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-foreground text-sm">Phone Number *</Label>
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

          {/* Name Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-foreground text-sm">First Name *</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-foreground text-sm">Last Name *</Label>
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
          </div>

          {/* Farm Name */}
          <div className="space-y-1.5">
            <Label htmlFor="farmName" className="text-foreground text-sm">Farm Name *</Label>
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
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-foreground text-sm">
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
            className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark mt-6"
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
