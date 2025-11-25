/**
 * PWA Install Prompt Component
 * Shows a native-like install prompt for Progressive Web App
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('PWA already installed');
      return;
    }

    // Check if dismissed
    const dismissed = localStorage.getItem('pwa-install-prompt-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Listen for beforeinstallprompt (Chrome, Edge, etc.)
    const handler = (e: Event) => {
      e.preventDefault();
      console.log('beforeinstallprompt event fired');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Wait 5 seconds before showing prompt (better UX)
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show manual install instructions after delay
    if (isIOSDevice) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 10000); // Show after 10 seconds on iOS
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt && !isIOS) return;

    if (deferredPrompt) {
      // Chrome/Edge install
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log(`User ${outcome} the install prompt`);
      
      if (outcome === 'accepted') {
        console.log('PWA installed successfully');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-prompt-dismissed', new Date().toISOString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  // iOS-specific install instructions
  if (isIOS && !deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-card border border-border rounded-lg shadow-lg z-50 animate-slide-up">
        <div className="p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-start gap-3 pr-6">
            <div className="text-3xl">🌾</div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">Install AskMyFarm</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Install this app to your home screen for quick access and offline use.
              </p>
              
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded">1</span>
                  <span>Tap the Share button <span className="inline-block">⬆️</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded">2</span>
                  <span>Scroll down and tap "Add to Home Screen"</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded">3</span>
                  <span>Tap "Add" in the top right</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chrome/Edge install prompt
  return (
    <div className="fixed bottom-20 left-4 right-4 bg-card border border-border rounded-lg shadow-lg z-50 animate-slide-up">
      <div className="p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-3 pr-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🌾</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Install AskMyFarm</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Add to your home screen for quick access and offline use in the field.
            </p>
            
            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                size="sm"
                className="flex-1 h-9"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Install App
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="h-9 px-3"
              >
                Not Now
              </Button>
            </div>
            
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Smartphone className="w-3 h-3" />
              <span>Works offline • Quick access • Native experience</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

