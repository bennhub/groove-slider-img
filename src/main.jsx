import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

function Main() {
  const [installPrompt, setInstallPrompt] = useState(null);

  // Service Worker Registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          console.log('Attempting to register service worker');
          console.log('Current origin:', window.location.origin);
          console.log('Current pathname:', window.location.pathname);

          const registration = await navigator.serviceWorker.register('/groove-slider-img/sw.js', {
            scope: '/groove-slider-img/',
            type: 'classic'
          });
          
          console.log('Service Worker registered successfully:', registration);
          console.log('Registration scope:', registration.scope);
        } catch (error) {
          console.error('Service Worker registration failed:', error);
          console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
      });
    }

    // PWA Installation Handler
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPrompt(e);
    };

    const handleAppInstalled = (evt) => {
      console.log('App was successfully installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setInstallPrompt(null);
    }
  };

  return (
    <StrictMode>
      <App installPrompt={installPrompt} onInstallClick={handleInstallClick} />
    </StrictMode>
  );
}

createRoot(document.getElementById('root')).render(<Main />);