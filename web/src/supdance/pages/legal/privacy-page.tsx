import { SERVICE_PRIVACY } from "./service-policies";
import { LinearLegalPage } from "./linear-legal-page";
import { MarketingPreferencesButton } from "@/supdance/marketing/consent";

export default function PrivacyPage() {
    return (
        <LinearLegalPage docMap={SERVICE_PRIVACY} currentSlug="privacy">
            <MarketingPreferencesButton />
        </LinearLegalPage>
    );
}
