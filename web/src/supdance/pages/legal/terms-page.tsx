import { SERVICE_TERMS } from "./service-policies";
import { LinearLegalPage } from "./linear-legal-page";

export default function TermsPage() {
    return <LinearLegalPage docMap={SERVICE_TERMS} currentSlug="terms" />;
}
