/** Legacy catalogs use {name}; native catalogs already use {{name}}. Preserve native and prompt tokens. */
export function toI18nextTemplate(text: string): string {
    return text.replace(/\{\{[^{}]+\}\}|\{([a-zA-Z0-9_]+)\}/g, (whole, name: string | undefined) => (name ? `{{${name}}}` : whole));
}
