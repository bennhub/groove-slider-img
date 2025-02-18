self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open("groove-gallery-cache").then((cache) => {
        return cache.addAll([
        './groove-slider-img/',  
        './groove-slider-img/index.html',
        './groove-slider-img/manifest.json',
        './groove-slider-img/icons/icon-192.png',
        './groove-slider-img/icons/icon-512.png'
        ]);
      })
    );
  });
  
  self.addEventListener("fetch", (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  });
  