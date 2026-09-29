/**
 * First-touch UTM attribution, client-side. The first page view that carries
 * utm_* query params stores them for the session; forms submit them so the
 * lead row can be tied back to its campaign in /admin/campaigns.
 */

const KEY = "bitsol_utm";

export interface UtmParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export function captureUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh: UtmParams = {};
    const source = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    if (source) fresh.utmSource = source.slice(0, 191);
    if (medium) fresh.utmMedium = medium.slice(0, 191);
    if (campaign) fresh.utmCampaign = campaign.slice(0, 191);

    if (Object.keys(fresh).length > 0) {
      // First touch wins for the session.
      if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, JSON.stringify(fresh));
      return { ...JSON.parse(sessionStorage.getItem(KEY) || "{}"), ...fresh };
    }
    const stored = sessionStorage.getItem(KEY);
    return stored ? (JSON.parse(stored) as UtmParams) : {};
  } catch {
    return {};
  }
}
