import { SITE_ORIGIN, site } from "@/content/site";
import { FAQ, SCHEDULE_ISO } from "@/content/sections";
import { SUPPORT_EMAIL } from "@/content/legal";

/**
 * JSON-LD for the homepage. Everything here is generated from the same
 * constants the page renders, so the machine-readable copy cannot claim
 * something the visible page does not.
 */
export default function StructuredData() {
  const organization = {
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: "Algorithms & Mathematics Society",
    alternateName: "AMS",
    url: "https://amsociety.in",
    email: SUPPORT_EMAIL,
    sameAs: [
      "https://www.linkedin.com/company/algorithms-mathematics-society/",
      "https://amsderive.in",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Mumbai",
      addressRegion: "Maharashtra",
      addressCountry: "IN",
    },
  };

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        url: `${SITE_ORIGIN}/`,
        name: "Ascent '26",
        description: site.seo.description,
        inLanguage: "en-IN",
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      },
      {
        "@type": "Event",
        "@id": `${SITE_ORIGIN}/#event`,
        name: "AMS Ascent '26",
        alternateName: ["Ascent '26", "Ascent 2026", "AMS Ascent"],
        description: site.seo.description,
        startDate: SCHEDULE_ISO.roundOne,
        endDate: SCHEDULE_ISO.roundThreeEnds,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
        inLanguage: "en-IN",
        isAccessibleForFree: true,
        organizer: { "@id": `${SITE_ORIGIN}/#organization` },
        sponsor: {
          "@type": "Organization",
          name: "Jane Street",
          url: "https://www.janestreet.com",
        },
        location: [
          {
            "@type": "VirtualLocation",
            name: "AMS Access",
            url: "https://www.amsaccess.com",
          },
          {
            "@type": "Place",
            name: "Mumbai",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Mumbai",
              addressRegion: "Maharashtra",
              addressCountry: "IN",
            },
          },
        ],
        offers: {
          "@type": "Offer",
          price: 0,
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
          validFrom: SCHEDULE_ISO.registrationOpens,
          validThrough: SCHEDULE_ISO.registrationCloses,
          url: `${SITE_ORIGIN}/register`,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_ORIGIN}/#faq`,
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
