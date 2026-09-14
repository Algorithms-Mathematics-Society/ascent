import LegalPage from "@/components/legal/LegalPage";
export const metadata = { title: "Legacy privacy consent | Ascent", robots: { index: false, follow: true } };
export default function LegacyConsentPage() {
  return <LegalPage title="Legacy registration consent" version="v1 (legacy record label)">
    <p>Earlier registration records used the label “v1” for this participation checkbox:</p>
    <blockquote className="border-l-2 border-ascent-border pl-4">I consent to the use of these details to administer my Ascent competition registration.</blockquote>
    <p>The form also stated that this covered competition participation only, with no opt-in to public profile visibility or sponsor sharing. A full policy was not published under that label. We do not treat those records as evidence that the current notice was shown or accepted earlier.</p>
    <p>Read the <a href="/privacy">current privacy policy</a>. New submissions record its specific version and URL. For questions or to withdraw consent, email <a href="mailto:team@amshq.in">team@amshq.in</a>.</p>
  </LegalPage>;
}
