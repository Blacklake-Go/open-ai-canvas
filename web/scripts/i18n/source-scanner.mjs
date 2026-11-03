import { parse } from "@babel/parser";
import { createHash } from "node:crypto";

export const hashText = (text) => createHash("sha256").update(text).digest("hex");
const visibleProperties = new Set(["title", "label", "placeholder", "description", "aria-label", "alt", "tooltip", "okText", "cancelText", "emptyText", "message", "content", "text", "help"]);
const textCalls = /^(?:message|notification|modal)\.(?:success|error|warning|info|loading|confirm)$/;

/** Extract UI sinks rather than every string: prompts, logs and business data stay out. */
export function scanSource(source, file) {
    let ast;
    try {
        ast = parse(source, { sourceFilename: file, sourceType: "unambiguous", plugins: ["typescript", ...(file.endsWith("tsx") ? ["jsx"] : [])] });
    } catch (error) {
        return { items: [], references: [], diagnostics: [{ file, message: error.message }] };
    }
    const items = [];
    const references = [];
    const counters = new Map();
    function add(node, text, context, dynamic = false) {
        text = text.replace(/\s+/g, " ").trim();
        if (!/[\u4e00-\u9fff]/.test(text) || text.length < 2) return;
        const count = (counters.get(context) ?? 0) + 1;
        counters.set(context, count);
        items.push({ id: hashText(`${file}:${context}:${count}`).slice(0, 24), sourceText: text, sourceHash: hashText(text), context, dynamic, references: [{ file, line: node.loc.start.line, column: node.loc.start.column + 1 }] });
    }
    function literal(node, context) {
        if (node.type === "JSXExpressionContainer") return literal(node.expression, context);
        if (node.type === "StringLiteral") add(node, node.value, context);
        else if (node.type === "TemplateLiteral") {
            let text = node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
            for (const [index, expression] of node.expressions.entries()) {
                const name = expression.type === "Identifier" ? expression.name : `value${index + 1}`;
                text += `{${name}}${node.quasis[index + 1].value.cooked ?? node.quasis[index + 1].value.raw}`;
            }
            add(node, text, context, true);
        } else if (node.type === "ConditionalExpression") {
            literal(node.consequent, `${context}:true`);
            literal(node.alternate, `${context}:false`);
        }
    }
    function visit(node, scope = "module", parent = null) {
        if (!node || typeof node !== "object" || typeof node.type !== "string") return;
        if ((node.type === "FunctionDeclaration" || node.type === "VariableDeclarator") && node.id?.name) scope = node.id.name;
        if (node.type === "JSXText") add(node, node.value, `${scope}:jsx`);
        else if (node.type === "JSXAttribute" && visibleProperties.has(node.name.name) && node.value) literal(node.value, `${scope}:attr:${node.name.name}`);
        else if (node.type === "JSXExpressionContainer" && ["JSXElement", "JSXFragment"].includes(parent?.type)) literal(node.expression, `${scope}:jsx-expression`);
        else if (node.type === "ObjectProperty") {
            const name = node.key.name ?? node.key.value;
            if (visibleProperties.has(name)) literal(node.value, `${scope}:property:${name}`);
        } else if (node.type === "CallExpression") {
            const callee = source.slice(node.callee.start, node.callee.end);
            if (textCalls.test(callee) && node.arguments[0]) literal(node.arguments[0], `${scope}:call:${callee}`);
            if ((callee === "t" || callee.endsWith(".t")) && node.arguments[0]?.type === "StringLiteral") {
                const key = node.arguments[0].value;
                if (!/[\u4e00-\u9fff]/.test(key)) references.push({ key, file, line: node.loc.start.line });
                else add(node.arguments[0], key, `${scope}:t-source`);
            }
        }
        for (const [key, value] of Object.entries(node)) {
            if (["loc", "comments", "tokens"].includes(key)) continue;
            if (Array.isArray(value)) value.forEach((child) => visit(child, scope, node));
            else if (value && typeof value === "object") visit(value, scope, node);
        }
    }
    visit(ast);
    return { items, references, diagnostics: [] };
}

export function compareManifests(previous, current) {
    const old = new Map(previous.map((item) => [item.id, item]));
    const next = new Map(current.map((item) => [item.id, item]));
    const added = current.filter((item) => !old.has(item.id));
    const retired = previous.filter((item) => !next.has(item.id));
    const signature = (item) => `${item.anchor ?? item.context ?? ""}:${item.sourceHash}`;
    const counts = (rows) => {
        const result = new Map();
        for (const row of rows) {
            const key = signature(row);
            result.set(key, (result.get(key) ?? 0) + 1);
        }
        return result;
    };
    const addedCounts = counts(added),
        retiredCounts = counts(retired);
    const moved = added.filter((item) => addedCounts.get(signature(item)) === 1 && retiredCounts.get(signature(item)) === 1);
    const movedSignatures = new Set(moved.map(signature));
    return {
        added: added.filter((item) => !movedSignatures.has(signature(item))),
        changed: current.filter((item) => old.has(item.id) && old.get(item.id).sourceHash !== item.sourceHash),
        retired: retired.filter((item) => !movedSignatures.has(signature(item))),
        moved,
    };
}

export function validateTranslation(source, translation) {
    if (typeof translation !== "string" || !translation.trim()) return "empty_translation";
    const tokens = (text) =>
        [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
            .map((m) => m[1])
            .sort()
            .join("|");
    if (tokens(source) !== tokens(translation)) return "placeholder_mismatch";
    const urls = (text) =>
        [...text.matchAll(/https?:\/\/[a-zA-Z0-9][^\s<>()（），,]*/g)]
            .map((m) => m[0])
            .sort()
            .join("|");
    if (urls(source) !== urls(translation)) return "url_mismatch";
    if (/<\/?[a-z][^>]*>/i.test(translation) && !/<\/?[a-z][^>]*>/i.test(source)) return "unexpected_markup";
    return null;
}
