import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Register service worker
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);