export type GoogleLatLngLiteral = { lat: number; lng: number };

export type GoogleLatLngBounds = {
  extend: (latLng: GoogleLatLngLiteral) => void;
  isEmpty: () => boolean;
};

export type GoogleMapInstance = {
  setCenter: (latLng: GoogleLatLngLiteral) => void;
  panTo: (latLng: GoogleLatLngLiteral) => void;
  getZoom: () => number | undefined;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
  addListener: (eventName: string, handler: (event: GoogleMapMouseEvent) => void) => GoogleMapsListener;
};

export type GoogleMapMouseEvent = {
  latLng?: { lat: () => number; lng: () => number } | null;
};

export type GoogleMapsListener = {
  remove: () => void;
};

export type GoogleOverlayViewInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  getPanes: () => { overlayMouseTarget: HTMLElement } | null;
  getProjection: () => {
    fromLatLngToDivPixel: (latLng: unknown) => { x: number; y: number } | null;
  } | null;
};

export type GooglePolygonInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

export type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

export type GoogleMapsNamespace = {
  Map: new (
    el: HTMLElement,
    opts: {
      center: GoogleLatLngLiteral;
      zoom: number;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
      clickableIcons?: boolean;
    },
  ) => GoogleMapInstance;
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => GoogleLatLngBounds;
  OverlayView: new () => GoogleOverlayViewInstance & {
    onAdd?: () => void;
    draw?: () => void;
    onRemove?: () => void;
  };
  Polygon: new (opts: {
    paths: GoogleLatLngLiteral[][];
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    clickable?: boolean;
    map: GoogleMapInstance;
  }) => GooglePolygonInstance;
  Polyline: new (opts: {
    path: GoogleLatLngLiteral[];
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    clickable?: boolean;
    map: GoogleMapInstance;
  }) => GooglePolylineInstance;
  event: {
    clearInstanceListeners: (instance: unknown) => void;
  };
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace };
    __koscoutGoogleMapsPromise?: Promise<GoogleMapsNamespace>;
    gm_authFailure?: () => void;
  }
}

export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps hanya dapat dimuat di browser."));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (window.__koscoutGoogleMapsPromise) {
    return window.__koscoutGoogleMapsPromise;
  }

  window.__koscoutGoogleMapsPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-koscout-gmaps="true"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error("Google Maps gagal diinisialisasi."));
      });
      existing.addEventListener("error", () => reject(new Error("Gagal memuat skrip Google Maps.")));
      return;
    }

    const script = document.createElement("script");
    script.dataset.koscoutGmaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        window.__koscoutGoogleMapsPromise = undefined;
        reject(new Error("Google Maps gagal diinisialisasi."));
      }
    };

    script.onerror = () => {
      window.__koscoutGoogleMapsPromise = undefined;
      reject(new Error("Gagal memuat skrip Google Maps. Periksa koneksi atau API key."));
    };

    document.head.appendChild(script);
  });

  return window.__koscoutGoogleMapsPromise;
}
