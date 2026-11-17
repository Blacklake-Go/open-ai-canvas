import { Navigate, useLocation } from "react-router";

export function PageManagementRedirect({ section }: { section: "models" | "html" | "email" }) {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    params.set("page", section);
    return <Navigate to={{ pathname: "/admin/plugins/page-management", search: params.toString(), hash: location.hash }} replace />;
}
