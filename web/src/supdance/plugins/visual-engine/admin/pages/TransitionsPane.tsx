import { GitCommit, Layers } from "lucide-react";

export function TransitionsPane() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <GitCommit className="h-5 w-5 text-sky-400" />
                    页面路由与工作区过渡 (Transitions)
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed mt-1">
                    统一管理由登录注册页至工作区（如 /register?next=%2Fprojects）的平滑过渡，消除白屏跳变。
                </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">页面路由过渡策略</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-1">
                        <span className="font-semibold text-foreground block">无缝淡入淡出 (Cross-fade)</span>
                        <span className="text-foreground/50 block">路由切换时维持 150ms 优雅透明度过渡</span>
                    </div>
                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-1">
                        <span className="font-semibold text-foreground block">业务安全守护</span>
                        <span className="text-foreground/50 block">next 目标参数严格校验，杜绝开放式重定向漏洞</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
