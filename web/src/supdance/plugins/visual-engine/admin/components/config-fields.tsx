import { useId } from "react";

export function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
    const id = useId();
    return (
        <label htmlFor={id} className="grid gap-2 text-sm">
            <span>{label}</span>
            <input
                id={id}
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(event) => {
                    const next = event.target.valueAsNumber;
                    if (Number.isFinite(next)) onChange(next);
                }}
                className="min-h-11 w-full rounded-lg border border-border bg-card px-3"
            />
        </label>
    );
}
export function ChoiceField({ label, value, choices, onChange }: { label: string; value: string; choices: readonly string[]; onChange: (value: string) => void }) {
    const id = useId();
    return (
        <label htmlFor={id} className="grid gap-2 text-sm">
            <span>{label}</span>
            <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-card px-3">
                {choices.map((choice) => (
                    <option key={choice} value={choice}>
                        {choice}
                    </option>
                ))}
            </select>
        </label>
    );
}
export function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
    return (
        <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5" />
            <span>{label}</span>
        </label>
    );
}
export function TextField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
    const id = useId();
    const props = { id, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), className: "min-h-11 w-full rounded-lg border border-border bg-card p-3" };
    return (
        <label htmlFor={id} className="grid min-w-0 gap-2 text-sm">
            <span>{label}</span>
            {multiline ? <textarea {...props} rows={4} /> : <input {...props} type="text" />}
        </label>
    );
}
