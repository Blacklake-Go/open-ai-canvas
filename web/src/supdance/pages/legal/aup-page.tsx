import { AUP_DOC_MAP } from "./legal-i18n-content";
import { LinearLegalPage } from "./linear-legal-page";

export default function AupPage() {
    return <LinearLegalPage docMap={AUP_DOC_MAP} currentSlug="aup" />;
}
