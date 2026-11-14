import { transformSync, type NodePath, type PluginObj } from "@babel/core";
import * as t from "@babel/types";
import type { Plugin } from "vite";
import { interfaceTextKey } from "../src/i18n/message-key";
import catalog from "../src/i18n/messages/interface.json";

export type StaticUiMessage = { key: string; source: string; file: string; line: number };
const han = /[\u4e00-\u9fff]/;
const attributes = new Set(["title", "label", "placeholder", "aria-label", "aria-description", "alt", "okText", "cancelText", "emptyText", "actionLabel", "loadingText"]);
const uiCollections = new Set(["options", "items", "menu", "columns", "actions", "primary", "secondary", "tabs"]);
const memberName = (node: t.Node) => (t.isMemberExpression(node) && t.isIdentifier(node.object) && t.isIdentifier(node.property) ? `${node.object.name}.${node.property.name}` : "");

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
        const tag = opening?.isJSXOpeningElement() && t.isJSXIdentifier(opening.node.name) ? opening.node.name.name : "";
        if (name === "description" && ["WorkspaceState", "WorkspaceErrorState", "SettingsSectionCard", "Popconfirm"].includes(tag) && /(?:auth-session-hydrator|canvas-script-editor|project-asset-audit|wechat-settings-section)\.tsx$/.test(file))
            return true;
        if (name === "content" && /(?:Tooltip|Popover|Popconfirm|Hint)$/.test(tag)) return true;
        return ["description", "detail", "help", "extra"].includes(name) && /^(?:Alert|Result|Empty|Card|AdminPageFrame|AdminSection|AdminSettingRow|AdminEmpty|FullScreenLoader|PrevisViewportNotice)$/.test(tag);
    }
    if (parent.isJSXElement() || parent.isJSXFragment()) return root.isJSXExpressionContainer();
    if (parent.isCallExpression() && parent.node.arguments[0] === root.node) return /^(message|notification|toast)\.(success|error|warning|info|loading)$/.test(memberName(parent.node.callee));
    if (parent.isObjectProperty()) {
        const name = t.isIdentifier(parent.node.key) ? parent.node.key.name : t.isStringLiteral(parent.node.key) ? parent.node.key.value : "";
        if (!["title", "content", "label", "okText", "cancelText", "message", "description", "detail"].includes(name)) return false;
        const owner = parent.findParent((ancestor) => ancestor.isVariableDeclarator() || ancestor.isFunctionDeclaration());
        if (
            name === "label" &&
            owner &&
            ((owner.isVariableDeclarator() && t.isIdentifier(owner.node.id) && ["STORYBOARD_COLUMN_OPTIONS", "agentFields"].includes(owner.node.id.name)) || (owner.isFunctionDeclaration() && owner.node.id?.name === "quotaUsageItems"))
        )
            return true;
        const object = parent.parentPath;
        if (name === "title" && file.endsWith("/canvas-script-editor.tsx") && owner?.isVariableDeclarator() && t.isIdentifier(owner.node.id, { name: "columns" })) return true;
        if (object?.isObjectExpression() && object.parentPath?.isCallExpression() && /^(?:modal\.confirm|notification\.(?:success|error|warning|info|open)|message\.open)$/.test(memberName(object.parentPath.node.callee))) return true;
        const attribute = parent.findParent((ancestor) => ancestor.isJSXAttribute() || ancestor.isFunction());
        return Boolean(attribute?.isJSXAttribute() && uiCollections.has(String(attribute.node.name.name)));
    }
    return false;
}

export function eligibleUiFile(file: string) {
    return /\.[jt]sx?$/.test(file) && file.includes("/src/") && !file.includes("/src/i18n/") && !file.includes("/supdance/plugins/i18n/") && !file.includes("/node_modules/");
}

export function transformStaticUi(source: string, file: string, options: { collectOnly?: boolean; knownKeys?: ReadonlySet<string> } = {}) {
    const messages: StaticUiMessage[] = [];
    const eligible = eligibleUiFile(file);
    if ((!eligible && !(options.collectOnly && file.includes("/supdance/plugins/i18n/admin/"))) || !han.test(source)) return { messages, code: source, map: null, changed: false };
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
                const call = register(clean, [], path.node.loc?.start.line ?? 0);
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
                const call = register(path.node.value, [], path.node.loc?.start.line ?? 0);
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
                const call = register(text, values, path.node.loc?.start.line ?? 0);
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
                if (options.collectOnly) register(path.node.arguments[0].value, [], path.node.loc?.start.line ?? 0, keyScope);
                else if (eligible && path.findParent((parent) => parent.isJSXElement() || parent.isJSXFragment())) {
                    register(path.node.arguments[0].value, [], path.node.loc?.start.line ?? 0, keyScope);
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
    function register(text: string, values: t.ObjectProperty[], line: number, keyScope = scope) {
        const key = interfaceTextKey(text, keyScope);
        messages.push({ key, source: text, file: scope, line });
        if (options.knownKeys && !options.knownKeys.has(key)) throw new Error(`Missing eight-locale UI entry: ${scope}:${line} ${key} ${text}`);
        return t.callExpression(alias, [t.stringLiteral(text), values.length ? t.objectExpression(values) : t.identifier("undefined"), t.stringLiteral(scope)]);
    }
    const result = transformSync(source, { filename: file, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", ...(/\.[jt]sx$/.test(file) ? ["jsx" as const] : [])] }, plugins: [plugin], sourceMaps: true, sourceFileName: file });
    return { messages, code: result?.code ?? source, map: result?.map ?? null, changed };
}

export function staticUiI18n(): Plugin {
    const knownKeys = new Set(Object.keys(catalog["zh-CN"]));
    return {
        name: "supdance-static-ui-i18n",
        enforce: "pre",
        transform(code, id) {
            const result = transformStaticUi(code, id.split("?")[0], { knownKeys });
            return result.changed ? { code: result.code, map: result.map } : null;
        },
    };
}
