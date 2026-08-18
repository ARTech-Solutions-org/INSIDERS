import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { registerPushToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { DownloadCloud, BellRing } from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(true); // default true to prevent flash
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(isStandaloneMode);
    };
    
    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
    
    if (ios) {
      // iOS doesn't support beforeinstallprompt, so we just show the modal if not standalone
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
    };
  }, []);

  const handleInstallAndNotify = async () => {
    // Request notification permissions
    try {
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await registerPushToken();
      }
    } catch (e) {
      console.error('Failed to get notification permission', e);
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    } else {
      // For iOS, they have to manually add to home screen, so we just close the prompt for notifications
      if (isStandalone) {
        setShowPrompt(false);
      }
    }
  };

  const needsPermission = 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied';
  
  // Check if user is on a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Force show if (on mobile and not installed) OR (needs notification permission)
  const shouldShow = (isMobile && !isStandalone) || needsPermission;

  if (!shouldShow) return null;

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="w-[90%] max-w-md rounded-2xl p-6 border-0 bg-background/95 backdrop-blur-xl shadow-2xl">
        <AlertDialogHeader>
          <div className="mx-auto w-16 h-16 bg-primary/10 flex items-center justify-center rounded-full mb-4">
            <DownloadCloud className="w-8 h-8 text-primary" />
          </div>
          <AlertDialogTitle className="text-center text-xl font-bold">Install App & Notifications</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base space-y-4 pt-2">
            <p className="text-foreground">
              For the best experience and to never miss an event, please add the app to your home screen.
            </p>
            
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex flex-col items-center gap-2">
              <BellRing className="w-6 h-6 text-primary animate-pulse" />
              <p className="font-bold text-primary">
                You must allow notifications to receive updates
              </p>
            </div>

            {isIOS && !isStandalone && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg text-left" dir="ltr">
                <strong>For iPhone:</strong> Tap the Share button below, then select "Add to Home Screen" ➕
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center mt-6">
          <Button onClick={handleInstallAndNotify} size="lg" className="w-full text-lg h-14 rounded-xl font-bold shadow-lg shadow-primary/20">
            {isIOS && !isStandalone ? 'Enable Notifications' : 'Accept & Install'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
