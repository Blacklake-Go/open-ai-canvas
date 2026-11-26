import { Clapperboard, Image, Music, ShoppingBag, Video } from "lucide-react";
import { Link } from "react-router";

import { trackSiteTrafficAction } from "@/services/site-traffic";
import { useI18n } from "@/supdance/plugins/i18n";

const tools = [
    { to: "/projects", label: "nav.sidebar.projects", Icon: Clapperboard },
    { to: "/ecommerce", label: "nav.sidebar.ecommerce", Icon: ShoppingBag },
    { to: "/workspace/image", label: "nav.sidebar.toolboxImage", Icon: Image },
    { to: "/toolbox/video", label: "nav.sidebar.toolboxVideo", Icon: Video },
    { to: "/toolbox/music", label: "upstream.creation.musicNavigation", Icon: Music },
] as const;

export function GuestCreationTools() {
    const { t } = useI18n();

    return (
        <nav aria-label={t("nav.sidebar.headingTools")} className="mb-5">
            <ul className="flex list-none flex-wrap gap-2 p-0">
                {tools.map(({ to, label, Icon }) => (
                    <li key={to}>
                        <Link to={to} onClick={to === "/ecommerce" ? () => trackSiteTrafficAction("open_ecommerce") : undefined} className="creation-guest-tool">
                            <Icon className="size-4 shrink-0" aria-hidden="true" />
                            <span>{t(label)}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
