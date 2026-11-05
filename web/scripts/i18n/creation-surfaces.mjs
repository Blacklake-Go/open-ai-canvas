import { parse } from "@babel/parser";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

export const CREATION_SURFACE_ROOTS = ["src/pages/ecommerce", "src/pages/projects", "src/lib/drama/novel-parse.ts", "src/lib/drama/drama-format.ts"];
const properties = new Set(["title", "label", "placeholder", "description", "aria-label", "alt", "tooltip", "okText", "cancelText", "emptyText", "message", "content", "text", "help", "detail", "hint", "guide", "error"]);
const han = /[\u3400-\u9fff]/;
export const creationTextKey = (source) => `creation.${createHash("sha256").update(source).digest("hex").slice(0, 16)}`;

// Only UI sinks are rewritten. Prompt builders, IDs, enum values, comparisons,
// persisted data and API payloads are outside this boundary.
export function creationSurfaceTexts(source, file) {
    const ast = parse(source, { sourceType: "module", plugins: ["typescript", ...(file.endsWith("tsx") ? ["jsx"] : [])] });
    const items = new Map();
    const add = (node, text, kind, expressions = [], rewrite = true) => {
        if (!han.test(text)) return;
        items.set(`${node.start}:${node.end}`, { start: node.start, end: node.end, source: text, key: creationTextKey(text), kind, expressions, rewrite, file, line: node.loc.start.line });
    };
    function literal(node, kind, rewrite = true) {
        if (!node) return;
        if (node.type === "JSXExpressionContainer") return literal(node.expression, "expression", rewrite);
        if (node.type === "StringLiteral") add(node, node.value, kind, [], rewrite);
        else if (node.type === "TemplateLiteral") {
            const expressions = node.expressions.map((expr) => source.slice(expr.start, expr.end));
            let text = node.quasis[0].value.cooked;
            node.expressions.forEach((_, i) => (text += `{value${i + 1}}${node.quasis[i + 1].value.cooked}`));
            add(node, text, kind, expressions, rewrite);
            node.expressions.forEach((expression) => literal(expression, "expression", rewrite));
        } else if (node.type === "ConditionalExpression") {
            literal(node.consequent, "expression", rewrite);
            literal(node.alternate, "expression", rewrite);
        } else if (node.type === "LogicalExpression") {
            literal(node.left, "expression", rewrite);
            literal(node.right, "expression", rewrite);
        } else if (node.type === "ArrayExpression") node.elements.forEach((child) => literal(child, "expression", rewrite));
    }
    const scalar = (node) => {
        if (!node) return false;
        if (node.type === "Identifier") return !/icon|children|content|node|extra|footer|prefix|suffix|badge|action|render|element/i.test(node.name);
        if (["StringLiteral", "NumericLiteral", "MemberExpression", "OptionalMemberExpression", "BinaryExpression", "TemplateLiteral"].includes(node.type)) return true;
        if (node.type === "CallExpression") return /^(?:Math\.|Number\b|String\b|formatCount\b|formatCredits\b|formatTime\b)/.test(source.slice(node.callee.start, node.callee.end));
        return false;
    };
    function visit(node, parent) {
        if (!node || typeof node !== "object" || !node.type) return;
        if (node.type === "JSXElement" || node.type === "JSXFragment") {
            const children = node.children;
            // Keep a sentence in one translation unit so word order can change.
            if (children.length > 1 && children.every((child) => child.type === "JSXText" || (child.type === "JSXExpressionContainer" && scalar(child.expression)))) {
                const expressions = [];
                const text = children
                    .map((child) => {
                        if (child.type === "JSXText") return child.value.replace(/\s+/g, " ");
                        expressions.push(source.slice(child.expression.start, child.expression.end));
                        return `{value${expressions.length}}`;
                    })
                    .join("")
                    .trim();
                if (han.test(text)) {
                    add({ start: children[0].start, end: children.at(-1).end, loc: children[0].loc }, text, "jsx", expressions);
                    for (const attr of node.openingElement?.attributes ?? []) visit(attr, node.openingElement);
                    return;
                }
            }
        }
        if (node.type === "JSXText") add(node, node.value.replace(/\s+/g, " ").trim(), "jsx");
        else if (node.type === "JSXAttribute" && properties.has(node.name.name)) literal(node.value, "attribute");
        else if (node.type === "JSXExpressionContainer" && ["JSXElement", "JSXFragment"].includes(parent?.type)) literal(node.expression, "expression");
        else if (node.type === "ObjectProperty" && properties.has(node.key.name ?? node.key.value)) literal(node.value, "expression", false);
        else if (node.type === "CallExpression") {
            const callee = source.slice(node.callee.start, node.callee.end);
            if (/^(?:message|notification|modal)\.(?:success|error|warning|info|loading|confirm)$/.test(callee) || /^(?:setStage|setError|setNotice|setErrorMessage)$/.test(callee)) literal(node.arguments[0], "expression");
            if (callee === "_creationText" && node.arguments[1]?.type === "ObjectExpression") node.arguments[1].properties.forEach((property) => literal(property.value, "expression"));
        } else if (node.type === "NewExpression" && node.callee.name === "Error") literal(node.arguments[0], "expression", false);
        else if (node.type === "ArrayExpression" && node.elements.length === 2 && node.elements[0]?.type === "StringLiteral") literal(node.elements[1], "expression", false);
        else if (node.type === "ReturnStatement" && file.endsWith("tsx")) literal(node.argument, "expression", false);
        // Catalogue component-local status maps without changing their data values.
        if (file.endsWith("tsx") && ["StringLiteral", "TemplateLiteral"].includes(node.type) && !items.has(`${node.start}:${node.end}`)) literal(node, "expression", false);
        for (const [key, value] of Object.entries(node)) {
            if (["loc", "comments", "tokens"].includes(key)) continue;
            if (Array.isArray(value)) value.forEach((child) => visit(child, node));
            else if (value && typeof value === "object") visit(value, node);
        }
    }
    visit(ast);
    // The enclosing JSX sentence owns nested literals, preventing overlapping edits.
    const sorted = [...items.values()].sort((a, b) => a.start - b.start || b.end - a.end);
    return sorted.filter((item, index) => !sorted.slice(0, index).some((other) => other.start <= item.start && other.end >= item.end));
}

export function creationSurfaceFiles(webRoot) {
    const files = [];
    function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const path = resolve(dir, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (/\.tsx?$/.test(entry.name)) files.push({ path, file: relative(webRoot, path).replaceAll("\\", "/"), source: readFileSync(path, "utf8") });
        }
    }
    CREATION_SURFACE_ROOTS.forEach((root) => {
        const path = resolve(webRoot, root);
        if (statSync(path).isDirectory()) walk(path);
        else files.push({ path, file: root, source: readFileSync(path, "utf8") });
    });
    return files;
}
