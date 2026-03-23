import { useEffect } from "react";

const ANALYTICS_SCRIPT_ID = "umami-analytics";

function buildAnalyticsScriptUrl(endpoint: string) {
  return `${endpoint.replace(/\/+$/, "")}/umami`;
}

export function AnalyticsLoader() {
  const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID?.trim();

  useEffect(() => {
    if (!analyticsEndpoint || !websiteId) {
      return;
    }

    if (document.getElementById(ANALYTICS_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = ANALYTICS_SCRIPT_ID;
    script.defer = true;
    script.src = buildAnalyticsScriptUrl(analyticsEndpoint);
    script.dataset.websiteId = websiteId;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [analyticsEndpoint, websiteId]);

  return null;
}
