import { Outlet } from "react-router";

import { UserProfileModalHost } from "@/components/layout/user-profile-modal";

/** Keep global account windows persistent while providing their panes with router context. */
export function SupDanceRouteHosts() {
    return (
        <>
            <Outlet />
            <UserProfileModalHost />
        </>
    );
}
