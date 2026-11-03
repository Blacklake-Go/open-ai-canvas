import { TOS_DOC_MAP } from "./legal-i18n-content";
import { LinearLegalPage } from "./linear-legal-page";

export default function TermsPage() {
    return <LinearLegalPage docMap={TOS_DOC_MAP} currentSlug="terms" />;
}
