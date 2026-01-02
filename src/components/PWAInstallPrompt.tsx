import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('🔵 PWA: Already installed, skipping prompt');
      return; // Already installed
    }

    // Check if user already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      console.log('🔵 PWA: User already dismissed prompt. Clear dengan: localStorage.removeItem("pwa-install-dismissed")');
      return; // User already dismissed
    }

    // Check browser support
    if (!('serviceWorker' in navigator)) {
      console.log('🔵 PWA: Browser tidak support service worker');
      return;
    }

    // Check if we're on HTTPS or localhost
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      console.log('🔵 PWA: Website harus menggunakan HTTPS untuk PWA');
      return;
    }

    let promptEvent: BeforeInstallPromptEvent | null = null;

    // Listen for beforeinstallprompt event (Chrome/Edge/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      // Show prompt immediately when event fires
      setShowPrompt(true);
      console.log('✅ PWA: beforeinstallprompt event fired, showing prompt');
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Fallback: Check if we can show prompt after delay (for production)
    // This helps when event doesn't fire immediately
    const fallbackTimer = setTimeout(() => {
      // Check if we have deferred prompt but haven't shown yet
      if (promptEvent && !showPrompt) {
        setDeferredPrompt(promptEvent);
        setShowPrompt(true);
        console.log('✅ PWA: Showing prompt via fallback (event already fired)');
      } else if (!promptEvent) {
        // Event hasn't fired yet, but we can still try to show a manual install option
        // Check if service worker is registered
        navigator.serviceWorker.getRegistrations().then((regs) => {
          if (regs.length > 0) {
            // Service worker exists, check manifest
            fetch('/manifest.webmanifest')
              .then((res) => {
                if (res.ok) {
                  console.log('⚠️ PWA: Event belum fire, tapi service worker & manifest OK');
                  console.log('   💡 User bisa install manual via browser menu (3 dots > Install app)');
                  console.log('   💡 Atau test di: /pwa-debug.html');
                }
              })
              .catch(() => {
                console.log('⚠️ PWA: Manifest tidak ditemukan');
              });
          } else {
            console.log('⚠️ PWA: Service worker belum ter-register');
          }
        });
      }
    }, 3000); // Check after 3 seconds

    // Debug: Log status after delay
    const debugTimer = setTimeout(() => {
      const stillDismissed = localStorage.getItem('pwa-install-dismissed');
      console.log('🔵 PWA Debug:', {
        dismissed: !!stillDismissed,
        hasDeferredPrompt: !!promptEvent,
        showPrompt: showPrompt,
        browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Edg') ? 'Edge' : 'Other',
        isSecure: isSecure,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches
      });
      if (!promptEvent && !stillDismissed) {
        console.log('⚠️ PWA: Event beforeinstallprompt belum fire setelah 5 detik. Kemungkinan:');
        console.log('   1. Browser tidak support (gunakan Chrome/Edge desktop)');
        console.log('   2. PWA sudah terinstall');
        console.log('   3. Kriteria PWA belum terpenuhi');
        console.log('   4. Service worker belum ter-register');
        console.log('   5. User engagement terlalu rendah (browser heuristic)');
        console.log('   💡 Test di: /pwa-debug.html');
        console.log('   💡 Clear localStorage: localStorage.removeItem("pwa-install-dismissed")');
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallbackTimer);
      clearTimeout(debugTimer);
    };
  }, [showPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-install-dismissed', 'true');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-border/50 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden relative">
                  <img 
                    src="/pwa-192x192.png" 
                    alt="PortionPal Logo" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback ke icon Eye jika gambar tidak load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = document.createElement('div');
                      fallback.className = 'w-full h-full flex items-center justify-center';
                      fallback.innerHTML = '<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>';
                      target.parentElement?.appendChild(fallback);
                    }}
                  />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Install PortionPal</h3>
                  <p className="text-sm text-muted-foreground">
                    Install untuk akses lebih cepat
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleInstall}
                className="flex-1 gap-2"
                size="sm"
              >
                <Download className="w-4 h-4" />
                Install
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                Nanti
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

