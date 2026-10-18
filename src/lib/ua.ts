/** Tiny handwritten user-agent parser — good enough for "Chrome 126 on macOS · Desktop". */
export type ParsedUA = { browser: string; browserVersion: string; os: string; osVersion: string; device: "desktop" | "mobile" | "tablet" | "bot" };

const BROWSERS: [string, RegExp][] = [
  ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
  ["Opera", /(?:OPR|Opera)\/([\d.]+)/],
  ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
  ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
  ["Safari", /Version\/([\d.]+).*Safari/],
];

export function parseUA(ua: string | null | undefined): ParsedUA {
  const s = ua || "";
  let browser = "Unknown";
  let browserVersion = "";
  for (const [name, re] of BROWSERS) {
    const m = s.match(re);
    if (m) {
      browser = name;
      browserVersion = m[1].split(".")[0];
      break;
    }
  }
  let os = "Unknown";
  let osVersion = "";
  let m: RegExpMatchArray | null;
  if ((m = s.match(/Windows NT ([\d.]+)/))) {
    os = "Windows";
    osVersion = ({ "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" } as Record<string, string>)[m[1]] || m[1];
  } else if ((m = s.match(/(?:iPhone|iPad|iPod).*? OS ([\d_]+)/))) {
    os = "iOS";
    osVersion = m[1].replace(/_/g, ".");
  } else if ((m = s.match(/Android ([\d.]+)/))) {
    os = "Android";
    osVersion = m[1];
  } else if ((m = s.match(/Mac OS X ([\d_.]+)/))) {
    os = "macOS";
    osVersion = m[1].replace(/_/g, ".");
  } else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Linux/.test(s)) os = "Linux";

  let device: ParsedUA["device"] = "desktop";
  if (/bot|crawler|spider|crawling|headless/i.test(s)) device = "bot";
  else if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(s)) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(s)) device = "mobile";
  return { browser, browserVersion, os, osVersion, device };
}
