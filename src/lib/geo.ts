/**
 * Free, offline visitor location: country from edge headers (cf-ipcountry / x-vercel-ip-country) when present,
 * otherwise from the browser time zone, then the Accept-Language region. City comes from the time zone name.
 */
const TZ_COUNTRY: Record<string, string> = {
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US",
  "America/Anchorage": "US", "Pacific/Honolulu": "US", "America/Detroit": "US", "America/Toronto": "CA", "America/Vancouver": "CA",
  "America/Montreal": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA", "America/Mexico_City": "MX",
  "America/Bogota": "CO", "America/Lima": "PE", "America/Santiago": "CL", "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR",
  "America/Buenos_Aires": "AR", "America/Caracas": "VE", "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR",
  "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE",
  "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Budapest": "HU", "Europe/Bucharest": "RO",
  "Europe/Athens": "GR", "Europe/Lisbon": "PT", "Europe/Istanbul": "TR", "Europe/Kiev": "UA", "Europe/Kyiv": "UA", "Europe/Moscow": "RU",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Kathmandu": "NP", "Asia/Colombo": "LK",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Tehran": "IR", "Asia/Jerusalem": "IL", "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY",
  "Asia/Jakarta": "ID", "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Manila": "PH", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW", "Asia/Seoul": "KR", "Asia/Tokyo": "JP", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
  "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Pacific/Auckland": "NZ", "Africa/Lagos": "NG", "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG", "Africa/Casablanca": "MA", "Africa/Accra": "GH",
};

export type Geo = { country: string; countryName: string; city: string; timezone: string; locale: string };

export function countryName(code: string) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

export function deriveGeo(input: { headers?: { get(name: string): string | null }; timezone?: string; language?: string }): Geo {
  const h = input.headers;
  const edge = (h?.get("cf-ipcountry") || h?.get("x-vercel-ip-country") || "").toUpperCase();
  const tz = (input.timezone || "").slice(0, 64);
  const lang = (input.language || h?.get("accept-language")?.split(",")[0] || "").trim().slice(0, 16);
  const region = lang.match(/^[a-z]{2,3}[-_]([A-Z]{2})\b/i)?.[1]?.toUpperCase() || "";
  let country = edge && /^[A-Z]{2}$/.test(edge) && edge !== "XX" ? edge : TZ_COUNTRY[tz] || region;
  if (!/^[A-Z]{2}$/.test(country)) country = "";
  const city = tz.includes("/") && TZ_COUNTRY[tz] ? tz.split("/").pop()!.replace(/_/g, " ") : "";
  return { country, countryName: countryName(country), city, timezone: tz, locale: lang };
}

export function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code || "")) return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
