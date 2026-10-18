import Script from "next/script";

export const metadata = { title: "Widget preview", robots: { index: false } };

/** Rendered inside the settings iframe: the real widget.js in preview mode, configured via postMessage. */
export default function WidgetPreview() {
  return (
    <div className="h-dvh overflow-hidden bg-[linear-gradient(160deg,#eef6f5,#f7f3f1)] p-6">
      <div className="mx-auto max-w-sm space-y-3 opacity-60" aria-hidden="true">
        <div className="h-6 w-1/2 rounded-lg bg-black/10" />
        <div className="h-3 w-full rounded bg-black/5" />
        <div className="h-3 w-5/6 rounded bg-black/5" />
        <div className="h-24 w-full rounded-xl bg-black/5" />
        <div className="h-3 w-2/3 rounded bg-black/5" />
      </div>
      <Script src="/widget.js" data-website="preview" data-preview="1" strategy="afterInteractive" />
    </div>
  );
}
