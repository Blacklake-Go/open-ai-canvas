import { PRIVACY_DOC_MAP } from "./legal-i18n-content";
import { LinearLegalPage } from "./linear-legal-page";

export default function PrivacyPage() {
    return <LinearLegalPage docMap={PRIVACY_DOC_MAP} currentSlug="privacy" />;
}
