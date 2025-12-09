import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, X, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { authAPI, foundingFarmerAPI } from "@/lib/api";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

const PhoneAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "signup"; // "signup" or "login"
  const approvalCode = searchParams.get("code"); // Founding Farmer approval code
  const { verifyPhone } = useAuth();
  const [step, setStep] = useState<"signup" | "verify">("signup");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    farmName: "",
    phoneNumber: "",
    email: "",
    password: "",
    confirmPassword: "",
    approvalCode: approvalCode || "",
  });
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const [verificationId, setVerificationId] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [sentChannels, setSentChannels] = useState({ sms: false, email: false });
  const [codeValidated, setCodeValidated] = useState(false);

  // Validate approval code when email is entered
  useEffect(() => {
    const validateApprovalCode = async () => {
      // Only validate if we have both approval code and a valid email format
      if (approvalCode && formData.email && formData.email.includes('@') && mode === "signup") {
        try {
          const result = await foundingFarmerAPI.validateCode(approvalCode, formData.email);
          if (result.valid) {
            setCodeValidated(true);
            toast.success("Approval code validated! You can proceed with sign-up.");
          }
        } catch (error: any) {
          const errorMessage = error?.details?.message || error?.message || "Invalid approval code";
          toast.error(errorMessage);
          // Redirect to founding farmers page
          setTimeout(() => navigate("/founding-farmers"), 2000);
        }
      }
    };
    
    validateApprovalCode();
  }, [approvalCode, formData.email, mode, navigate]);

  // Start countdown timer
  useEffect(() => {
    if (step === "verify" && resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, resendTimer]);

  // Password validation helper
  const validatePassword = (pwd: string): string | null => {
    if (!pwd) return null; // Password is optional
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Password must include at least one uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Password must include at least one lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must include at least one number";
    return null;
  };

  const handleSendCode = async () => {
    // Validate based on mode
    if (mode === "signup") {
      // Sign up requires all fields including email
      if (!formData.firstName || !formData.lastName || !formData.farmName || !formData.phoneNumber || !formData.email) {
        toast.error("Please fill in all required fields");
        return;
      }
      
      // Validate password if provided
      if (formData.password) {
        const passwordError = validatePassword(formData.password);
        if (passwordError) {
          toast.error(passwordError);
          return;
        }
        
        // Check password confirmation
        if (formData.password !== formData.confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }
      }
      
      // Validate approval code if present
      if (formData.approvalCode && !codeValidated) {
        try {
          const result = await foundingFarmerAPI.validateCode(formData.approvalCode, formData.email);
          if (!result.valid) {
            toast.error("Invalid approval code. Please check your email.");
            return;
          }
          setCodeValidated(true);
        } catch (error: any) {
          const errorMessage = error?.details?.message || error?.message || "Invalid approval code";
          toast.error(errorMessage);
          return;
        }
      }
    } else {
      // Login requires email only (SMS temporarily disabled until A2P campaign is approved)
      if (!formData.email) {
        toast.error("Please enter your email address");
        return;
      }
    }

    // Phone number validation only for signup (SMS disabled for login)
    if (mode === "signup" && formData.phoneNumber && formData.phoneNumber.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setIsLoading(true);
    try {
      // Format phone number if provided
      const formattedPhone = formData.phoneNumber ? `+1${formData.phoneNumber}` : undefined;

      if (mode === "signup") {
        // Sign up flow - create new account
        const response = await authAPI.sendMagicLink({
          phone_number: formattedPhone!,
          first_name: formData.firstName,
          last_name: formData.lastName,
          farm_name: formData.farmName,
          email: formData.email || undefined,
          password: formData.password || undefined, // Include password for hybrid auth
        });
        
        setVerificationId(response.verification_id);
        setSentChannels({ sms: response.sms_sent, email: response.email_sent });
        
        // Show contextual message based on what succeeded
        let successMessage = "Verification code sent! ";
        if (response.sms_sent && response.email_sent) {
          successMessage += "Check your phone and email.";
        } else if (response.sms_sent) {
          successMessage += "Check your phone.";
        } else if (response.email_sent) {
          successMessage += "Check your email.";
        }
        
        toast.success(successMessage);
      } else {
        // Login flow - send code to existing user (email only, SMS temporarily disabled)
        const response = await authAPI.sendLoginCode({
          email: formData.email,
        });
        
        setVerificationId(response.verification_id);
        setSentChannels({ sms: response.sms_sent, email: response.email_sent });
        
        toast.success("Verification code sent!");
      }
      
      setStep("verify");
      setResendTimer(60);
    } catch (error: any) {
      // Handle specific error cases
      if (error?.message?.includes("already registered") || error?.status === 409) {
        if (mode === "signup") {
          toast.error(
            "This phone number is already registered. Please log in instead.",
            {
              action: {
                label: "Go to Login",
                onClick: () => navigate("/auth/auto-token?mode=login")
              }
            }
          );
        } else {
          toast.error(error?.message || "Failed to send code. Please try again.");
        }
      } else if (error?.message?.includes("not found") || error?.status === 404) {
        if (mode === "login") {
          toast.error(
            "Account not found. Please sign up first.",
            {
              action: {
                label: "Sign Up",
                onClick: () => navigate("/auth/auto-token?mode=signup")
              }
            }
          );
        } else {
          toast.error(error?.message || "Failed to send code. Please try again.");
        }
      } else {
        toast.error(error?.message || "Failed to send code. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    const code = verificationCode.join("");
    if (code.length !== 6) {
      toast.error("Please enter the complete code");
      return;
    }

    setIsLoading(true);
    try {
      await verifyPhone(verificationId, code);
      
      // Mark approval code as used if this was a founding farmer signup
      if (mode === "signup" && formData.approvalCode && formData.email) {
        try {
          await foundingFarmerAPI.markCodeUsed(formData.approvalCode, formData.email);
        } catch (error) {
          console.error("Failed to mark approval code as used:", error);
          // Don't block signup if this fails
        }
      }
      
      // Show appropriate success message
      if (mode === "signup") {
        toast.success("Account created! Welcome to AskMyFarm");
        // New users → show welcome page with JD connect prompt
        navigate("/welcome-new");
      } else {
        toast.success("Welcome back!");
        // After token login, ask if user wants to set/reset password
        navigate("/set-password", { replace: true });
      }
    } catch (error: any) {
      toast.error(error?.message || "Invalid code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    try {
      await handleSendCode();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  if (step === "signup") {
    // For login mode, show simplified form matching Login page style
    if (mode === "login") {
      return (
        <div className="min-h-screen page-background-hero flex flex-col overflow-y-auto scrollbar-hide">
          <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 py-12 lg:px-0">
            {/* Left Mobile Indicator - Desktop Only */}
            <MobileFirstIndicator />

            {/* Main Content */}
            <div className="w-full max-w-md">
              {/* Back Button */}
              <Button
                variant="ghost"
                onClick={() => navigate('/auth/login')}
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
                <span className="text-farm-gold">My</span>
                <span className="text-primary">Farm</span>
              </h2>
              
              <h1 className="text-2xl md:text-3xl font-bold text-primary mb-3">
                Access with Token
              </h1>
              <p className="text-sm text-farm-muted">
                Enter your email to receive a verification code
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSendCode(); }} className="space-y-6">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your-email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                  required
                  className="bg-card border-border"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark mt-8"
                size="lg"
                disabled={isLoading || !formData.email}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending Token...
                  </>
                ) : (
                  'Send Token'
                )}
              </Button>
            </form>

            <p className="text-xs text-farm-muted text-center mt-4">
              We'll send a verification code to your email
            </p>

            {/* Footer */}
            <div className="mt-8 space-y-3">
              <div className="flex justify-center gap-4 text-xs">
                <button
                  onClick={() => navigate('/terms')}
                  className="text-farm-muted hover:text-farm-text underline"
                >
                  Terms
                </button>
                <span className="text-farm-muted">•</span>
                <button
                  onClick={() => navigate('/privacy')}
                  className="text-farm-muted hover:text-farm-text underline"
                >
                  Privacy
                </button>
              </div>
            </div>
            </div>

            {/* Right Mobile Indicator - Desktop Only */}
            <MobileFirstIndicator />
          </main>
        </div>
      );
    }

    // Signup mode - keep existing form
    return (
      <div className="min-h-screen page-background flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 border-b">
          <button onClick={() => navigate("/")} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Create Account</h2>
          <button onClick={() => navigate("/")} className="p-2">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 px-6 py-8 overflow-y-auto scrollbar-hide">
          <div className="max-w-md mx-auto space-y-6 animate-fade-in">
            <div>
              <h1 className="page-title text-left">Let's get started</h1>
              <p className="body-text">
                Create your account to start managing your farm
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="h-12 mt-2"
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="h-12 mt-2"
                />
              </div>

              <div>
                <Label htmlFor="farmName">Farm Name *</Label>
                <Input
                  id="farmName"
                  type="text"
                  placeholder="e.g., Richman Farms"
                  value={formData.farmName}
                  onChange={(e) => setFormData({...formData, farmName: e.target.value})}
                  className="h-12 mt-2"
                />
              </div>

              {/* Phone number input */}
              <div>
                <Label htmlFor="phoneNumber">Mobile Number *</Label>
                <div className="flex gap-2 mt-2">
                  <div className="flex items-center px-3 h-12 border rounded-md bg-muted text-farm-muted font-medium">
                    +1
                  </div>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    inputMode="numeric"
                    placeholder="555 555 5555"
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({...formData, phoneNumber: value});
                    }}
                    className={`h-12 flex-1 ${
                      formData.phoneNumber.length > 0 && formData.phoneNumber.length !== 10
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                  />
                </div>
                <p className={`text-xs mt-1 ${
                  formData.phoneNumber.length > 0 && formData.phoneNumber.length !== 10
                    ? 'text-destructive'
                    : 'text-farm-muted'
                }`}>
                  {formData.phoneNumber.length > 0 && formData.phoneNumber.length !== 10
                    ? `${formData.phoneNumber.length}/10 digits - Enter a valid 10-digit phone number`
                    : 'Enter 10-digit US phone number'}
                </p>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  required
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="h-12 mt-2"
                />
              </div>

              <div>
                <Label htmlFor="password">Password (optional)</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="h-12 mt-2"
                />
                <p className="text-xs text-farm-muted mt-1">
                  Set a password to login faster, or skip and use verification codes
                </p>
              </div>

              {formData.password && (
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className={`h-12 mt-2 ${
                      formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                  />
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-destructive mt-1">
                      Passwords do not match
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button 
              onClick={handleSendCode} 
              disabled={isLoading}
              className="w-full h-14 text-base font-semibold bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            >
              {isLoading ? "Sending Code..." : "Continue"}
            </Button>

            <p className="text-xs text-farm-muted text-center">
              By continuing, you agree to our Terms & Privacy
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b">
        <button onClick={() => setStep("signup")} className="p-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Verify Code</h2>
        <button onClick={() => navigate("/")} className="p-2">
          <X className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 px-6 py-8 overflow-y-auto scrollbar-hide">
        <div className="max-w-md mx-auto space-y-8 animate-fade-in">
          <div className="text-center">
            <h1 className="page-title">Enter the code</h1>
            <p className="body-text">
              {sentChannels.sms && sentChannels.email && "Check your phone and email"}
              {sentChannels.sms && !sentChannels.email && `Sent to ${formData.phoneNumber}`}
              {!sentChannels.sms && sentChannels.email && `Sent to ${formData.email}`}
            </p>
          </div>

          {/* Code Input */}
          <div className="flex justify-center gap-2">
            {verificationCode.map((digit, index) => (
              <Input
                key={index}
                id={`code-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeInput(index, e.target.value)}
                className="w-12 h-14 text-center text-xl font-semibold bg-white dark:bg-white text-gray-900 border-gray-300 focus:border-primary focus:ring-primary"
              />
            ))}
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-farm-muted">Didn't receive code?</p>
            {resendTimer > 0 ? (
              <p className="text-sm text-farm-muted">Resend in {resendTimer} seconds</p>
            ) : (
              <button 
                onClick={handleResendCode}
                className="text-sm text-primary font-semibold hover:underline"
              >
                Resend code
              </button>
            )}
          </div>

          <Button 
            onClick={handleVerify} 
            disabled={isLoading}
            className="w-full h-14 text-base font-semibold bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
          >
            {isLoading ? "Verifying..." : "Verify & Continue"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default PhoneAuth;
