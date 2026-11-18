import { Outlet } from "react-router";
import type { ReactNode } from "react";

import { UserProfileModalHost } from "@/components/layout/user-profile-modal";

/** Keep global account windows persistent while providing their panes with router context. */
export function SupDanceRouteHosts({ children }: { children?: ReactNode }) {
    return (
        <>
            {children ?? <Outlet />}
            <UserProfileModalHost />
        </>
    );
}
