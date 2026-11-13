import { i18n } from "./index";
import { toI18nextTemplate } from "./interpolation";
import { interfaceTextKey } from "./message-key";
export { interfaceTextKey } from "./message-key";

/** Explicit UI sinks only: never apply to prompts, names entered by users or task parameters. */
export function interfaceText(source: string, values?: Record<string, unknown>, scope = ""): string {
    return i18n.t(interfaceTextKey(source, scope), { ...values, defaultValue: toI18nextTemplate(source) }) as string;
}
