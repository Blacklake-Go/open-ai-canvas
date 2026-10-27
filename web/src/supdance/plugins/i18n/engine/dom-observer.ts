import type { SupDanceLocaleCode } from "../types";
import { translateSourceText, type CompiledI18nDictionary } from "./translator";

const IGNORED_TAG_NAMES = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT", "SVG", "MATH"]);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

export type DomTranslatorOptions = {
    translateAdminPages?: boolean;
};

/**
 * Zero-intrusion reactive DOM translator with lossless original-text restoration.
 *
 * Every modified Text node and Element attribute has its original Chinese value
 * recorded in a WeakMap, allowing instant rollback when switching back to zh-CN
 * or when the supdance-i18n plugin is disabled in `/admin/plugins`.
 */
export class SupDanceDomTranslator {
    private originalTextByNode = new WeakMap<Text, string>();
    private touchedTextNodes = new Set<Text>();
    private originalAttrsByElement = new WeakMap<Element, Map<string, string>>();
    private touchedElements = new Set<Element>();
    private observer: MutationObserver | null = null;
    private isApplying = false;
    private rafId: number | null = null;
    private currentDictionary: CompiledI18nDictionary | null = null;
    private currentLocale: SupDanceLocaleCode = "zh-CN";
    private fallbackLocale: SupDanceLocaleCode = "zh-CN";
    private options: DomTranslatorOptions = { translateAdminPages: false };
    private targetRoot: HTMLElement | null = null;

    public attach(root: HTMLElement, dictionary: CompiledI18nDictionary, locale: SupDanceLocaleCode, fallbackLocale: SupDanceLocaleCode = "zh-CN", options: DomTranslatorOptions = {}): void {
        this.targetRoot = root;
        this.currentDictionary = dictionary;
        this.currentLocale = locale;
        this.fallbackLocale = fallbackLocale;
        this.options = options;

        this.applyToSubtree(root);

        if (typeof MutationObserver !== "undefined" && !this.observer) {
            this.observer = new MutationObserver((mutations) => {
                if (this.isApplying) return;
                const pendingRoots = new Set<Node>();
                for (const mutation of mutations) {
                    if (mutation.type === "characterData" && mutation.target) {
                        pendingRoots.add(mutation.target);
                    } else if (mutation.type === "attributes" && mutation.target) {
                        pendingRoots.add(mutation.target);
                    } else if (mutation.type === "childList") {
                        for (let i = 0; i < mutation.addedNodes.length; i++) {
                            const node = mutation.addedNodes[i];
                            if (node) pendingRoots.add(node);
                        }
                    }
                }
                if (pendingRoots.size > 0) {
                    this.scheduleBatch(pendingRoots);
                }
            });
            this.observer.observe(root, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
            });
        }
    }

    public update(dictionary: CompiledI18nDictionary, locale: SupDanceLocaleCode, fallbackLocale: SupDanceLocaleCode = "zh-CN", options: DomTranslatorOptions = {}): void {
        this.currentDictionary = dictionary;
        this.currentLocale = locale;
        this.fallbackLocale = fallbackLocale;
        this.options = options;
        if (this.targetRoot) {
            this.applyToSubtree(this.targetRoot);
        }
    }

    public restoreAndDetach(): void {
        if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.isApplying = true;
        try {
            for (const textNode of this.touchedTextNodes) {
                const original = this.originalTextByNode.get(textNode);
                if (original !== undefined && textNode.nodeValue !== original) {
                    textNode.nodeValue = original;
                }
            }
            this.touchedTextNodes.clear();

            for (const element of this.touchedElements) {
                const attrMap = this.originalAttrsByElement.get(element);
                if (!attrMap) continue;
                for (const [attr, originalValue] of attrMap.entries()) {
                    if (element.getAttribute(attr) !== originalValue) {
                        element.setAttribute(attr, originalValue);
                    }
                }
            }
            this.touchedElements.clear();
        } finally {
            this.isApplying = false;
        }
    }

    private scheduleBatch(nodes: Set<Node>): void {
        const run = () => {
            this.rafId = null;
            for (const node of nodes) {
                this.applyToSubtree(node);
            }
        };
        if (typeof requestAnimationFrame !== "undefined") {
            if (this.rafId !== null) cancelAnimationFrame(this.rafId);
            this.rafId = requestAnimationFrame(run);
        } else {
            run();
        }
    }

    private shouldIgnoreElement(element: Element | null): boolean {
        let current: Element | null = element;
        while (current) {
            if (IGNORED_TAG_NAMES.has(current.tagName)) return true;
            if (current.hasAttribute("data-i18n-ignore")) return true;
            const contentEditable = current.getAttribute("contenteditable");
            if (contentEditable === "true" || contentEditable === "") return true;
            if (current.classList?.contains("ProseMirror") || current.classList?.contains("excalidraw") || current.classList?.contains("cm-editor")) {
                return true;
            }
            if (!this.options.translateAdminPages && current.hasAttribute("data-admin-root")) {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    }

    public applyToSubtree(root: Node): void {
        if (!this.currentDictionary) return;
        this.isApplying = true;
        try {
            if (root.nodeType === 3) {
                this.processTextNode(root as Text);
                return;
            }
            if (root.nodeType !== 1) return;
            const rootElement = root as Element;
            if (this.shouldIgnoreElement(rootElement)) {
                return;
            }
            this.processElementAttributes(rootElement);
            this.walkNode(rootElement);
        } finally {
            this.isApplying = false;
        }
    }

    private walkNode(element: Element): void {
        const childNodes = element.childNodes;
        for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i];
            if (!child) continue;
            if (child.nodeType === 3) {
                this.processTextNode(child as Text);
            } else if (child.nodeType === 1) {
                const childEl = child as Element;
                if (this.shouldIgnoreElement(childEl)) continue;
                this.processElementAttributes(childEl);
                this.walkNode(childEl);
            }
        }
    }

    private processTextNode(textNode: Text): void {
        if (!this.currentDictionary) return;
        const parent = textNode.parentElement;
        if (parent && this.shouldIgnoreElement(parent)) return;

        const currentValue = textNode.nodeValue ?? "";
        if (!currentValue.trim()) return;

        let baseSource = this.originalTextByNode.get(textNode);
        if (baseSource === undefined) {
            baseSource = currentValue;
        } else {
            // Check if React updated the underlying textNode to a brand new Chinese string
            const previousTranslated = translateSourceText(this.currentDictionary, baseSource, this.currentLocale, this.fallbackLocale);
            if (currentValue !== baseSource && currentValue !== previousTranslated) {
                const isNewSourceMatch = translateSourceText(this.currentDictionary, currentValue, this.currentLocale, this.fallbackLocale) !== null;
                if (isNewSourceMatch) {
                    baseSource = currentValue;
                    this.originalTextByNode.set(textNode, baseSource);
                }
            }
        }

        const translated = translateSourceText(this.currentDictionary, baseSource, this.currentLocale, this.fallbackLocale);
        if (translated !== null) {
            if (!this.originalTextByNode.has(textNode)) {
                this.originalTextByNode.set(textNode, baseSource);
            }
            this.touchedTextNodes.add(textNode);
            if (textNode.nodeValue !== translated) {
                textNode.nodeValue = translated;
            }
        } else if (this.originalTextByNode.has(textNode) && this.currentLocale === "zh-CN") {
            const orig = this.originalTextByNode.get(textNode)!;
            if (textNode.nodeValue !== orig) {
                textNode.nodeValue = orig;
            }
        }
    }

    private processElementAttributes(element: Element): void {
        if (!this.currentDictionary) return;
        for (const attr of TRANSLATABLE_ATTRIBUTES) {
            const currentVal = element.getAttribute(attr);
            if (!currentVal || !currentVal.trim()) continue;

            let attrMap = this.originalAttrsByElement.get(element);
            let baseSource = attrMap?.get(attr);
            if (baseSource === undefined) {
                baseSource = currentVal;
            } else {
                const prevTranslated = translateSourceText(this.currentDictionary, baseSource, this.currentLocale, this.fallbackLocale);
                if (currentVal !== baseSource && currentVal !== prevTranslated) {
                    if (translateSourceText(this.currentDictionary, currentVal, this.currentLocale, this.fallbackLocale) !== null) {
                        baseSource = currentVal;
                        attrMap!.set(attr, baseSource);
                    }
                }
            }

            const translated = translateSourceText(this.currentDictionary, baseSource, this.currentLocale, this.fallbackLocale);
            if (translated !== null) {
                if (!attrMap) {
                    attrMap = new Map<string, string>();
                    this.originalAttrsByElement.set(element, attrMap);
                }
                if (!attrMap.has(attr)) {
                    attrMap.set(attr, baseSource);
                }
                this.touchedElements.add(element);
                if (element.getAttribute(attr) !== translated) {
                    element.setAttribute(attr, translated);
                }
            }
        }
    }
}
