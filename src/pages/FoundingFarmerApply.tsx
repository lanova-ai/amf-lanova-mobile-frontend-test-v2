import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";
import { foundingFarmerAPI } from "@/lib/api";
import { toast } from "sonner";

export default function FoundingFarmerApply() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [hasJDOps, setHasJDOps] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName || !lastName || !email || !hasJDOps) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      await foundingFarmerAPI.submitApplication({
        first_name: firstName,
        last_name: lastName,
        email,
        has_jd_ops: hasJDOps === "yes"
      });

      setSubmitted(true);
      toast.success("Application submitted successfully!");
    } catch (error: any) {
      const errorMessage = error?.details?.message || error?.message || "Failed to submit application";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen page-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-3">Application Submitted!</h1>
          
          <p className="text-sm text-farm-muted mb-6">
            We'll review your application and send you an approval link via email within 1-2 business days.
          </p>
          
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="w-full"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-background flex flex-col overflow-y-auto scrollbar-hide">
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 py-12 lg:px-0">
        {/* Left Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />

        {/* Main Content */}
        <div className="w-full max-w-md">
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
            <span className="text-farm-gold">My</span>
            <span className="text-primary">Farm</span>
          </h2>
          
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-3">
            Join Founding Farmer Program
          </h1>
          <p className="text-sm text-farm-muted">
            Fill out the form below to apply
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-foreground">First Name *</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={isSubmitting}
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-foreground">Last Name *</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={isSubmitting}
                className="bg-card border-border"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              className="bg-card border-border"
            />
          </div>

          {/* JD Ops Question */}
          <div className="space-y-3">
            <Label className="text-foreground">Do you use John Deere Operations Center? *</Label>
            <RadioGroup value={hasJDOps} onValueChange={setHasJDOps} className="space-y-3">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="jd-yes" disabled={isSubmitting} />
                <Label htmlFor="jd-yes" className="font-normal cursor-pointer text-foreground">
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="jd-no" disabled={isSubmitting} />
                <Label htmlFor="jd-no" className="font-normal cursor-pointer text-foreground">
                  No
                </Label>
              </div>
            </RadioGroup>
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
                Submitting...
              </>
            ) : (
              "Submit Application"
            )}
          </Button>
        </form>
        </div>

        {/* Right Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />
      </main>
    </div>
  );
}

