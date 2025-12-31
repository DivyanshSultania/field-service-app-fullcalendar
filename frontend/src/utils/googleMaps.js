// Common Google Maps utilities

export const GOOGLE_MAPS_API_KEY = 'AIzaSyDZzaPfNdYjTI0ahEmZTo7KftX9nSglOD4';

// Helper: Google Maps API loader
export function loadGoogleMapsApi(apiKey = GOOGLE_MAPS_API_KEY) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      return resolve(window.google.maps);
    }

    // Prevent loading script multiple times
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.onload = () => resolve(window.google.maps);
      existingScript.onerror = reject;
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = (err) => {
      console.error('Google Maps Load error', err);
      reject(err);
    };

    document.body.appendChild(script);
  });
}