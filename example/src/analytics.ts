/**
 * Analytics for the demo: Plausible, OpenPanel and Google Analytics 4.
 *
 * Plausible and OpenPanel are loaded by the official snippets in
 * `index.html`. GA4 loads from here, and only when a measurement ID is set.
 */

type EventProps = Record<string, string | number | boolean>;

type PlausibleFn = (event: string, options?: { props?: EventProps }) => void;
type OpenPanelFn = (method: 'track', event: string, props?: EventProps) => void;
type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn;
    op?: OpenPanelFn;
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

/**
 * GA4 measurement ID. Empty until the GA4 property exists; while empty,
 * GA4 is not loaded and no GA4 events are sent.
 */
export const GA_MEASUREMENT_ID: string = '';

export function initGoogleAnalytics(): void {
  if (!GA_MEASUREMENT_ID) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.append(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js expects the `arguments` object itself, not a copied array.
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
}

/** Sends one event to every tracker that is loaded. */
export function track(event: string, props: EventProps = {}): void {
  window.plausible?.(event, { props });
  window.op?.('track', event, props);
  window.gtag?.('event', event, props);
}
