import { Drawer, type DrawerProps } from "antd";
import type { CSSProperties } from "react";
import { resolveOverlayExtensionStyles, useOverlayExtensionRevision } from "@/lib/overlay-extensions";

// 用途：产品侧栏壳。消费 token 由内容自己负责。默认 destroyOnHidden，可选 flush 去内边距。
export type AppDrawerProps = DrawerProps & {
    flush?: boolean;
};

export function AppDrawer({ flush = false, destroyOnHidden = true, styles, className, rootClassName, ...props }: AppDrawerProps) {
    useOverlayExtensionRevision();
    const mergeResolvedStyles = (resolved: unknown) => {
        const base = resolveOverlayExtensionStyles("drawer", resolved);
        if (!flush) return base;
        const body = base.body && typeof base.body === "object" ? (base.body as CSSProperties) : {};
        return { ...base, body: { ...body, padding: 0 } };
    };
    const mergedStyles = typeof styles === "function" ? (info: { props: DrawerProps }) => mergeResolvedStyles(styles(info)) : mergeResolvedStyles(styles);

    return <Drawer destroyOnHidden={destroyOnHidden} className={className} rootClassName={rootClassName} {...props} styles={mergedStyles as DrawerProps["styles"]} />;
}
