import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { MobileFirstIndicator } from '@/components/MobileFirstIndicator';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      
      // Email/password login means user already exists - go straight to home
      navigate(returnTo || '/home');
      
      toast.success('Welcome back!');
    } catch (error: any) {
      console.error('Login failed:', error);
      
      // Check if user doesn't exist
      if (error?.status === 404 || error?.message?.toLowerCase().includes('not found') || error?.message?.toLowerCase().includes('no user found')) {
        toast.error(
          "Account not found. Please apply to join the Founding Farmer Program.",
          {
            duration: 5000,
            action: {
              label: "Apply",
              onClick: () => navigate('/founding-farmers/apply')
            }
          }
        );
      } else {
        toast.error(error.message || 'Invalid email or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
            onClick={() => navigate('/')}
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
            Welcome Back
          </h1>
          <p className="text-sm text-farm-muted">
            Sign in to access your farm data
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your-email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
              required
              className="bg-card border-border"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              required
              className="bg-card border-border"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark mt-8"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-transparent px-2 text-farm-muted">Or</span>
          </div>
        </div>

        {/* Alternative: Access with Token */}
        <Button
          variant="outline"
          className="w-full border-border hover:bg-muted"
          onClick={() => navigate('/auth/auto-token?mode=login')}
          disabled={isLoading}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Access with Token
        </Button>

        <p className="text-xs text-farm-muted text-center mt-4">
          Can't remember your password? Use a verification code sent to your email
        </p>

        {/* Footer */}
        <div className="mt-8 space-y-3">
          <p className="text-xs text-farm-muted text-center">
            New to AskMyFarm?{' '}
            <button
              onClick={() => navigate('/founding-farmers/apply')}
              className="text-primary underline hover:text-primary/80"
            >
              Join Founding Farmer Program
            </button>
          </p>
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

