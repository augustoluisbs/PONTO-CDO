import { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    if (installed) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setShowBanner(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [installed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa-banner-dismissed', '1');
  };

  if (installed || !showBanner || sessionStorage.getItem('pwa-banner-dismissed')) {
    return null;
  }

  return (
    <div
      className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:max-w-sm z-50 slide-up"
      style={{
        background: 'rgba(15, 23, 42, 0.97)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '16px',
        padding: '16px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.25)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}
        >
          <span className="text-2xl">⏱️</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Instalar PontoFlow</p>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
            Acesse rapidamente pelo celular, funciona offline!
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="btn-primary text-xs px-4 py-1.5"
              style={{ fontSize: '0.8rem' }}
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="btn-secondary text-xs px-4 py-1.5"
              style={{ fontSize: '0.8rem' }}
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
