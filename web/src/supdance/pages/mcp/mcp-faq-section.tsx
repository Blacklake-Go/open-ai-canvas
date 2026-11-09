import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { MCP_FAQS } from "./mcp-plugin-list";

export function McpFaqSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="relative mx-auto mt-20 max-w-4xl px-4 sm:px-6">
            <div className="text-center">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-500 dark:text-rose-400 uppercase">
                    <HelpCircle className="size-3.5" />
                    <span>Frequently Asked Questions</span>
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">常见问题与故障排查</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">安装环境、权限策略与 AI 客户端连接的常见疑难解答。</p>
            </div>

            <div className="mt-8 space-y-3">
                {MCP_FAQS.map((faq, idx) => {
                    const isOpen = openIndex === idx;
                    return (
                        <div key={faq.question} className="overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors dark:border-white/10 dark:bg-[#121217]">
                            <button type="button" onClick={() => toggle(idx)} className="flex w-full items-center justify-between p-4.5 text-left text-sm font-semibold text-zinc-900 hover:text-rose-600 sm:px-6 dark:text-zinc-100 dark:hover:text-rose-400">
                                <span className="pr-4">{faq.question}</span>
                                <ChevronDown className={`size-4 shrink-0 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-rose-500" : ""}`} />
                            </button>

                            {isOpen && <div className="border-t border-zinc-100 px-4.5 pb-5 pt-3.5 text-xs leading-relaxed text-zinc-600 sm:px-6 dark:border-white/5 dark:text-zinc-300">{faq.answer}</div>}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
