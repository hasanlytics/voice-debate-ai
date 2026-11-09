// Google Analytics (GA4) Integration Helper

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

// Default GA4 Measurement ID (can be configured via VITE_GA_MEASUREMENT_ID in .env)
export const DEFAULT_GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-DEBATEAI01';

/**
 * Initialize Google Analytics (GA4)
 */
export function initGA(measurementId: string = DEFAULT_GA_ID) {
  if (typeof window === 'undefined') return;

  // Don't inject multiple times
  if (typeof window.gtag === 'function') {
    return;
  }

  const dataLayer = (window.dataLayer = window.dataLayer || []);
  window.gtag = function () {
    dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_path: window.location.pathname,
    send_page_view: true,
  });

  // Dynamically inject GA4 script if not present
  const scriptId = 'google-analytics-gtag';
  if (!document.getElementById(scriptId) && measurementId && !measurementId.includes('0000')) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }
}

/**
 * Track custom GA4 events
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  try {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, params);
    }
    // Also track in console in development mode
    if (import.meta.env.DEV) {
      console.log(`[GA4 Event] ${eventName}:`, params);
    }
  } catch (err) {
    console.warn('GA4 track error:', err);
  }
}

/**
 * Track page views
 */
export function trackPageView(pageTitle: string, path: string = window.location.pathname) {
  try {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: pageTitle,
        page_location: window.location.href,
        page_path: path,
      });
    }
  } catch {}
}
