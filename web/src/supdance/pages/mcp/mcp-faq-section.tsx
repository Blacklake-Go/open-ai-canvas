import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useLocaleStore } from "@/stores/use-locale-store";
import { MCP_BUILDING_FAQS } from "./mcp-plugin-list";

export function McpFaqSection() {
    const locale = useLocaleStore((s) => s.locale);
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div id="faqs" className="mcp-faq-wrap">
            <div>
                <span className="mcp-eyebrow mcp-eyebrow--light">常见问题与说明</span>
                <h2 className="mcp-section-h2">研发说明与常见问题</h2>
                <p className="mcp-section-lead">关于当前 MCP 构建进展、线上已开放连接器及未来安全边界的坦诚说明。</p>
            </div>

            <div className="mcp-faq-list">
                {MCP_BUILDING_FAQS.map((faq, idx) => {
                    const isOpen = openIndex === idx;
                    const questionText = faq.q[locale];
                    const answerText = faq.a[locale];
                    return (
                        <div key={faq.id} className="mcp-faq-item">
                            <button type="button" onClick={() => toggle(idx)} className="mcp-faq-trigger" aria-expanded={isOpen}>
                                <span>{questionText}</span>
                                <ChevronDown className={`size-4 shrink-0 transition-transform duration-200${isOpen ? " rotate-180" : ""}`} strokeWidth={1.8} aria-hidden="true" />
                            </button>
                            {isOpen ? <div className="mcp-faq-answer">{answerText}</div> : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
