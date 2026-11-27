import { transformSync, type NodePath, type PluginObj } from "@babel/core";
import * as t from "@babel/types";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";
import { interfaceTextKey } from "../src/i18n/message-key";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";
import { toI18nextTemplate } from "../src/i18n/interpolation";
import catalog from "../src/i18n/messages/interface.json";

export type StaticUiMessage = { key: string; source: string; file: string; line: number };
const han = /[\u4e00-\u9fff]/;
const attributes = new Set(["title", "label", "placeholder", "aria-label", "aria-description", "alt", "okText", "cancelText", "emptyText", "actionLabel", "loadingText"]);
const uiCollections = new Set(["options", "items", "menu", "columns", "actions", "primary", "secondary", "tabs"]);
// Literal copy on these component props is rendered to the user. Properties on data objects
// with the same names (including prompts, descriptions and model parameters) are independent.
const displayProps: Record<string, ReadonlySet<string>> = {
    description: new Set([
        "AdminTableEmpty",
        "AnalyticsAttentionItem",
        "AssetPicker",
        "CapabilityGroup",
        "CreationMediaNotice",
        "EcommerceLibraryPanel",
        "EmptyState",
        "FormSectionTitle",
        "PageHeader",
        "ParameterField",
        "Popconfirm",
        "PromptTemplateDialog",
        "ProtocolParameterCard",
        "ReferenceCard",
        "SectionHeading",
        "SettingsSectionCard",
        "WorkspaceErrorState",
        "WorkspaceForbiddenState",
        "WorkspaceNoResultsState",
        "WorkspaceState",
    ]),
    detail: new Set(["AdminStatTile", "AnalyticsHealthCard", "ArkStatCard", "CreationMediaNotice", "FlowStep", "MenuButton", "PerformanceKpi", "UpdateAlert", "WorkspaceLoadingState"]),
    extra: new Set(["AdminDrawer", "AppDrawer", "Form.Item"]),
    help: new Set(["ColorTokenField", "Form.Item"]),
    tooltip: new Set(["Form.Item"]),
    message: new Set(["Alert"]),
    text: new Set(["MenuLabel"]),
};
const memberName = (node: t.Node) => (t.isMemberExpression(node) && t.isIdentifier(node.object) && t.isIdentifier(node.property) ? `${node.object.name}.${node.property.name}` : "");
// These declarations describe controls. Sibling IDs, shortcut keys, skin definitions
// and any strings that are submitted to a generator retain their original values.
const displayDefinitions: Record<string, ReadonlySet<string>> = {
    "canvas-shortcuts.ts": new Set(["CANVAS_SHORTCUT_CATEGORIES", "CANVAS_SHORTCUTS"]),
    "previs-shortcuts.ts": new Set(["PREVIS_SHORTCUT_GUIDE"]),
    "skin-themes.ts": new Set(["SKIN_BUTTON_COLOR_FIELDS", "SKIN_COLOR_GROUPS", "SKIN_COMPONENT_NUMBER_FIELDS"]),
    "banner-notice.ts": new Set(["BANNER_NOTICE_TYPES", "BANNER_NOTICE_EMOJI_GROUPS"]),
    "feature-availability-panel.tsx": new Set(["featureGroups"]),
};

function preserved(path: NodePath): boolean {
    return Boolean(
        path.findParent((parent) => {
            if (!parent.isJSXElement()) return false;
            const opening = parent.node.openingElement;
            if (t.isJSXIdentifier(opening.name) && ["pre", "code", "script", "style", "textarea"].includes(opening.name.name)) return true;
            return opening.attributes.some(
                (attribute) =>
                    t.isJSXAttribute(attribute) && (attribute.name.name === "data-i18n-ignore" || attribute.name.name === "data-i18n-preserve-source" || (attribute.name.name === "translate" && t.isStringLiteral(attribute.value, { value: "no" }))),
            );
        }),
    );
}

/** Only proven UI sinks qualify; event payloads and arbitrary object fields never do. */
function isUiValue(path: NodePath, file = ""): boolean {
    if (preserved(path)) return false;
    let root = path;
    while (root.parentPath?.isConditionalExpression() || root.parentPath?.isLogicalExpression()) root = root.parentPath;
    if (root.parentPath?.isJSXExpressionContainer()) root = root.parentPath;
    const parent = root.parentPath;
    if (!parent) return false;
    if (parent.isJSXAttribute()) {
        const name = String(parent.node.name.name);
        if (attributes.has(name)) return true;
        const opening = parent.parentPath;
        const element = opening?.isJSXOpeningElement() ? opening.node.name : undefined;
        const tag = t.isJSXIdentifier(element) ? element.name : t.isJSXMemberExpression(element) && t.isJSXIdentifier(element.object) ? `${element.object.name}.${element.property.name}` : "";
        if (displayProps[name]?.has(tag)) return true;
        if (name === "content" && /(?:Tooltip|Popover|Popconfirm|Hint)$/.test(tag)) return true;
        return ["description", "detail", "help", "extra"].includes(name) && /^(?:Alert|Result|Empty|Card|AdminPageFrame|AdminSection|AdminSettingRow|AdminEmpty|FullScreenLoader|PrevisViewportNotice)$/.test(tag);
    }
    if (parent.isJSXElement() || parent.isJSXFragment()) return root.isJSXExpressionContainer();
    if (parent.isCallExpression() && parent.node.arguments[0] === root.node) return /^(message|notification|toast)\.(success|error|warning|info|loading)$/.test(memberName(parent.node.callee));
    if (parent.isObjectProperty()) {
        const name = t.isIdentifier(parent.node.key) ? parent.node.key.name : t.isStringLiteral(parent.node.key) ? parent.node.key.value : "";
        const definition = parent.findParent((ancestor) => ancestor.isVariableDeclarator() || ancestor.isFunction());
        if (definition?.isVariableDeclarator() && t.isIdentifier(definition.node.id) && displayDefinitions[file.split("/").pop()!]?.has(definition.node.id.name) && ["title", "label", "description", "group", "help"].includes(name)) return true;
        if (!["title", "content", "label", "okText", "cancelText", "message", "description", "detail", "extra", "unit", "shortTitle"].includes(name)) return false;
        const owner = parent.findParent((ancestor) => ancestor.isVariableDeclarator() || ancestor.isFunctionDeclaration());
        if (name === "label" && file.endsWith("/previs-canvas-dock.tsx") && owner?.isVariableDeclarator() && t.isIdentifier(owner.node.id, { name: "items" })) return true;
        if (
            name === "label" &&
            owner &&
            ((owner.isVariableDeclarator() && t.isIdentifier(owner.node.id) && ["STORYBOARD_COLUMN_OPTIONS", "agentFields"].includes(owner.node.id.name)) || (owner.isFunctionDeclaration() && owner.node.id?.name === "quotaUsageItems"))
        )
            return true;
        const object = parent.parentPath;
        if (file.endsWith(".tsx") && owner?.isVariableDeclarator() && t.isIdentifier(owner.node.id) && object?.isObjectExpression() && object.parentPath?.isArrayExpression()) {
            const collection = owner.node.id.name;
            if (name === "title" && /columns$/i.test(collection)) return true;
            if (name === "label" && /options$/i.test(collection) && object.node.properties.some((p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: "value" }))) return true;
            if (file.endsWith("/runtime-policy-settings-page.tsx") && ["resourceFields", "storageFields", "concurrencyFields", "timeoutFields", "rateFields", "relayFields", "policySections"].includes(collection)) return true;
        }
        if (["extra", "unit", "shortTitle"].includes(name)) return false;
        if (name === "title" && file.endsWith("/canvas-script-editor.tsx") && owner?.isVariableDeclarator() && t.isIdentifier(owner.node.id, { name: "columns" })) return true;
        if (object?.isObjectExpression() && object.parentPath?.isCallExpression() && /^(?:modal\.confirm|notification\.(?:success|error|warning|info|open)|message\.open)$/.test(memberName(object.parentPath.node.callee))) return true;
        const attribute = parent.findParent((ancestor) => ancestor.isJSXAttribute() || ancestor.isFunction());
        if (!attribute?.isJSXAttribute()) return false;
        if (name === "message" && t.isJSXIdentifier(attribute.node.name, { name: "rules" })) {
            const opening = attribute.parentPath;
            const tag = opening?.isJSXOpeningElement() ? opening.node.name : undefined;
            return t.isJSXMemberExpression(tag) && t.isJSXIdentifier(tag.object, { name: "Form" }) && t.isJSXIdentifier(tag.property, { name: "Item" });
        }
        return uiCollections.has(String(attribute.node.name.name));
    }
    return false;
}

export function eligibleUiFile(file: string) {
    return /\.[jt]sx?$/.test(file) && file.includes("/src/") && !file.includes("/src/i18n/") && !file.includes("/supdance/plugins/i18n/") && !file.includes("/node_modules/");
}

export function transformStaticUi(source: string, file: string, options: { collectOnly?: boolean; knownKeys?: ReadonlySet<string> } = {}) {
    const messages: StaticUiMessage[] = [];
    const eagerKeys = new Set<string>();
    const eligible = eligibleUiFile(file);
    if ((!eligible && !(options.collectOnly && file.includes("/supdance/plugins/i18n/admin/"))) || !han.test(source)) return { messages, eagerKeys, code: source, map: null, changed: false };
    const scope = "src/" + file.replaceAll("\\", "/").split("/src/").at(-1)!;
    let changed = false;
    let alias: t.Identifier;
    let subscriptionAlias: t.Identifier;
    const components = new Set<NodePath<t.Function>>();
    function markJsx(path: NodePath) {
        if (!path.findParent((parent) => parent.isJSXElement() || parent.isJSXFragment())) return;
        let owner = path.getFunctionParent();
        while (owner) {
            let name = owner.isFunctionDeclaration() || owner.isFunctionExpression() ? owner.node.id?.name : undefined;
            let declaration = owner.parentPath;
            while (declaration?.isCallExpression() || declaration?.isTSAsExpression() || declaration?.isTSSatisfiesExpression()) declaration = declaration.parentPath;
            if (!name && declaration?.isVariableDeclarator() && t.isIdentifier(declaration.node.id)) name = declaration.node.id.name;
            if ((name && /^(?:[A-Z]|use[A-Z])/.test(name)) || declaration?.isExportDefaultDeclaration()) {
                components.add(owner as NodePath<t.Function>);
                return;
            }
            owner = owner.getFunctionParent();
        }
        throw path.buildCodeFrameError("Static interface text needs an owning React component or hook for publication updates");
    }
    const plugin = (): PluginObj => ({
        visitor: {
            Program: {
                enter(path) {
                    alias = path.scope.generateUidIdentifier("sdInterfaceText");
                    let hookName = "useStaticUiTranslation",
                        suffix = 0;
                    while (new RegExp(`\\b${hookName}\\b`).test(source)) hookName = `useStaticUiTranslation${++suffix}`;
                    subscriptionAlias = t.identifier(hookName);
                },
                exit(path) {
                    for (const component of components) {
                        const statement = t.expressionStatement(t.callExpression(subscriptionAlias, []));
                        if (t.isBlockStatement(component.node.body)) component.node.body.body.unshift(statement);
                        else component.node.body = t.blockStatement([statement, t.returnStatement(component.node.body)]);
                    }
                    if (components.size) path.unshiftContainer("body", t.importDeclaration([t.importSpecifier(subscriptionAlias, t.identifier("useTranslation"))], t.stringLiteral("react-i18next")));
                    if (changed) path.unshiftContainer("body", t.importDeclaration([t.importSpecifier(alias, t.identifier("interfaceText"))], t.stringLiteral("@/i18n/interface-text")));
                },
            },
            JSXText(path) {
                if (!eligible) return;
                if (preserved(path)) return;
                const wrapper = t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier("span"), []), t.jsxClosingElement(t.jsxIdentifier("span")), [path.node]);
                const literal = t.react.buildChildren(wrapper)[0];
                if (!t.isStringLiteral(literal) || !han.test(literal.value)) return;
                const clean = literal.value.trim();
                if (!clean) return;
                const call = register(clean, [], path.node.loc?.start.line ?? 0, scope, !path.getFunctionParent());
                if (options.collectOnly) return;
                markJsx(path);
                const nodes: t.JSXExpressionContainer[] = [];
                if (/^\s/.test(literal.value)) nodes.push(t.jsxExpressionContainer(t.stringLiteral(" ")));
                nodes.push(t.jsxExpressionContainer(call));
                if (/\s$/.test(literal.value)) nodes.push(t.jsxExpressionContainer(t.stringLiteral(" ")));
                path.replaceWithMultiple(nodes);
                path.skip();
                changed = true;
            },
            StringLiteral(path) {
                if (!eligible) return;
                if (!han.test(path.node.value) || !isUiValue(path, file)) return;
                const call = register(path.node.value, [], path.node.loc?.start.line ?? 0, scope, !path.getFunctionParent());
                if (options.collectOnly) return;
                markJsx(path);
                path.replaceWith(path.parentPath.isJSXAttribute() ? t.jsxExpressionContainer(call) : call);
                path.skip();
                changed = true;
            },
            TemplateLiteral(path) {
                if (!eligible) return;
                if (!path.node.quasis.some((part) => han.test(part.value.cooked ?? part.value.raw)) || !isUiValue(path, file)) return;
                let text = path.node.quasis[0].value.cooked ?? path.node.quasis[0].value.raw;
                const values: t.ObjectProperty[] = [];
                path.node.expressions.forEach((expression, index) => {
                    if (!t.isExpression(expression)) throw new Error("Invalid UI interpolation expression");
                    const name = `value${index + 1}`;
                    text += `{${name}}${path.node.quasis[index + 1].value.cooked ?? path.node.quasis[index + 1].value.raw}`;
                    values.push(t.objectProperty(t.identifier(name), expression));
                });
                const call = register(text, values, path.node.loc?.start.line ?? 0, scope, !path.getFunctionParent());
                if (!options.collectOnly) {
                    markJsx(path);
                    path.replaceWith(call);
                    path.skip();
                    changed = true;
                }
            },
            CallExpression(path) {
                if (!t.isIdentifier(path.node.callee, { name: "interfaceText" }) || !t.isStringLiteral(path.node.arguments[0])) return;
                const keyScope = t.isStringLiteral(path.node.arguments[2]) ? path.node.arguments[2].value : "";
                const text = path.node.arguments[0].value;
                const inJsx = eligible && path.findParent((parent) => parent.isJSXElement() || parent.isJSXFragment());
                if (options.collectOnly || inJsx || options.knownKeys?.has(interfaceTextKey(text, keyScope))) register(text, [], path.node.loc?.start.line ?? 0, keyScope, !path.getFunctionParent());
                if (!options.collectOnly && inJsx) {
                    markJsx(path);
                    changed = true;
                }
            },
            ObjectProperty(path) {
                // These fields describe built-in template cards; HTML source, IDs and defaults stay canonical.
                if (!options.collectOnly || !file.endsWith("/supdance/plugins/html-page-manager/templates/index.ts")) return;
                const name = t.isIdentifier(path.node.key) ? path.node.key.name : "";
                if (["name", "badge", "description"].includes(name) && t.isStringLiteral(path.node.value)) register(path.node.value.value, [], path.node.loc?.start.line ?? 0);
            },
        },
    });
    function register(text: string, values: t.ObjectProperty[], line: number, keyScope = scope, eager = false) {
        const key = interfaceTextKey(text, keyScope);
        if (eager) eagerKeys.add(key);
        messages.push({ key, source: text, file: scope, line });
        if (options.knownKeys && !options.knownKeys.has(key)) throw new Error(`Missing eight-locale UI entry: ${scope}:${line} ${key} ${text}`);
        return t.callExpression(alias, [t.stringLiteral(text), values.length ? t.objectExpression(values) : t.identifier("undefined"), t.stringLiteral(scope)]);
    }
    const result = transformSync(source, { filename: file, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", ...(/\.[jt]sx$/.test(file) ? ["jsx" as const] : [])] }, plugins: [plugin], sourceMaps: true, sourceFileName: file });
    return { messages, eagerKeys, code: result?.code ?? source, map: result?.map ?? null, changed };
}

const compactCatalogId = "\0supdance:compact-interface-catalog";
const emptyCatalogId = "\0supdance:empty-interface-catalog";
const packPrefix = "virtual:supdance-interface:";
const commonPack = "common";
const packMarker = (name: string, code: string) => `__supdance_ui_pack:${name}:${code}__`;

function interfacePackName(file: string) {
    const [directory, area, feature] = file.split("/src/").at(-1)!.split("/");
    if (directory === "pages" && !area.includes(".")) return `page-${area}`;
    if ((directory === "components" || directory === "lib") && area === "canvas") return "canvas";
    if (directory === "supdance" && area === "plugins" && feature && !feature.includes(".")) return `plugin-${feature}`;
    return "shared";
}

export function staticUiCatalogModule(catalogs: Record<string, Record<string, string>>) {
    const locales = Object.entries(catalogs);
    const keys = [...new Set(locales.flatMap(([, messages]) => Object.keys(messages)))];
    const columns = locales.map(([code, messages]) => [code, keys.map((key) => messages[key] ?? null)]);
    const payload = JSON.stringify(JSON.stringify([keys, columns]));
    // Ship each key once and keep each locale's sentences adjacent for compression.
    return `
        const [keys, columns] = JSON.parse(${payload});
        for (const column of columns) {
            const messages = {};
            column[1].forEach((text, index) => {
                if (text !== null) messages[keys[index]] = text;
            });
            column[1] = messages;
        }
        export default Object.fromEntries(columns);
    `;
}

export function staticUiI18n(): Plugin {
    const catalogs: Record<string, Record<string, string>> = catalog;
    const knownKeys = new Set(Object.keys(catalogs["zh-CN"]));
    const packKeys = new Map<string, Set<string>>();
    const requestedPacks = new Set<string>();
    const packPaths = new Map<string, string>();
    const assignedKeys = new Set<string>();
    const commonKeys = new Set<string>();
    let productionBuild = false;
    const startupInterfaceId = packPrefix + commonPack;
    return {
        name: "supdance-static-ui-i18n",
        enforce: "pre",
        configResolved(config) {
            productionBuild = config.command === "build";
        },
        resolveId(source, importer) {
            if (source === startupInterfaceId) return "\0" + source;
            if (!productionBuild) return;
            if (source.startsWith(packPrefix)) return "\0" + source;
            if (!source.endsWith("/messages/interface.json")) return;
            const file = importer?.replaceAll("\\", "/");
            if (file?.endsWith("/src/i18n/catalogs.ts")) return emptyCatalogId;
            if (file?.endsWith("/managed-interface-admin.ts")) return compactCatalogId;
        },
        load(id) {
            if (id === compactCatalogId) return staticUiCatalogModule(catalogs);
            if (id === emptyCatalogId) return `export default ${JSON.stringify(Object.fromEntries(SUPPORTED_LOCALES.map(({ code }) => [code, {}])))};`;
            if (!id.startsWith("\0" + packPrefix)) return;
            const name = id.slice(packPrefix.length + 1);
            if (!productionBuild) return "export const prepareStartupInterface = () => Promise.resolve();";
            requestedPacks.add(name);
            const urls = SUPPORTED_LOCALES.map(({ code }) => `${JSON.stringify(code)}: new URL(/* @vite-ignore */ ${JSON.stringify(packMarker(name, code))}, import.meta.url).href`);
            const pack = `{${urls.join(",")}}`;
            if (name === commonPack) {
                return `const pack = ${pack}; export const prepareStartupInterface = () => import("@/i18n").then(({ installInterfacePack }) => installInterfacePack(pack));`;
            }
            // Async module initializers can wait on one another in circular production chunks.
            return `import { installInterfacePack } from "@/i18n"; void installInterfacePack(${pack});`;
        },
        transform(code, id) {
            const file = id.split("?")[0].replaceAll("\\", "/");
            const collectOnly = productionBuild && (file.includes("/supdance/plugins/i18n/admin/") || file.endsWith("/supdance/plugins/html-page-manager/templates/index.ts"));
            const result = transformStaticUi(code, file, { knownKeys, collectOnly });
            if (!productionBuild) return result.changed ? { code: result.code, map: result.map } : null;
            if (file.includes("/src/") && !file.includes("/node_modules/") && /\.[jt]sx?$/.test(file)) {
                for (const [key] of code.matchAll(/\bmanagedUi\.[0-9a-f]{1,8}\b/g)) if (knownKeys.has(key)) commonKeys.add(key);
            }
            if (!result.messages.length) return result.changed ? { code: result.code, map: result.map } : null;
            const group = interfacePackName(file);
            const keys = packKeys.get(group) ?? new Set<string>();
            for (const row of result.messages) {
                if (result.eagerKeys.has(row.key) || interfaceTextKey(row.source) === row.key) commonKeys.add(row.key);
                else {
                    assignedKeys.add(row.key);
                    keys.add(row.key);
                }
            }
            if (!keys.size) return result.changed ? { code: result.code, map: result.map } : null;
            packKeys.set(group, keys);
            return { code: `${result.code}\nimport "${packPrefix}${group}";`, map: result.map };
        },
        buildEnd(error) {
            if (error || !productionBuild) return;
            // Hand-written lookups and historical keys remain available on every route.
            for (const key of knownKeys) if (!assignedKeys.has(key)) commonKeys.add(key);
            packKeys.set(commonPack, commonKeys);
            for (const name of requestedPacks) {
                const keys = packKeys.get(name)!;
                for (const { code } of SUPPORTED_LOCALES) {
                    const messages = Object.fromEntries(Array.from(keys, (key) => [key.slice("managedUi.".length), toI18nextTemplate(catalogs[code][key])]));
                    const source = JSON.stringify(messages);
                    const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
                    const filename = `ui-${name}-${code}-${hash}.json`;
                    packPaths.set(packMarker(name, code), `./${filename}`);
                    this.emitFile({ type: "asset", fileName: `assets/${filename}`, source });
                }
            }
        },
        renderChunk(code) {
            const next = code.replace(/__supdance_ui_pack:[\w-]+:[\w-]+__/g, (marker) => {
                const path = packPaths.get(marker);
                if (!path) throw new Error(`Interface translation asset missing for ${marker}`);
                return path;
            });
            return next === code ? null : { code: next, map: null };
        },
    };
}
