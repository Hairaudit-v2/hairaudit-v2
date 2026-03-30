import Script from "next/script";

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;

/**
 * Loads Google Tag Manager when NEXT_PUBLIC_GTM_ID is set (e.g. GTM-XXXX).
 * No-op when unset or malformed.
 */
export default function GoogleTagManager() {
  const raw = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  if (!raw || !GTM_ID_PATTERN.test(raw)) {
    return null;
  }
  const gtmId = raw;

  return (
    <>
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`}
          height={0}
          width={0}
          title="Google Tag Manager"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}
