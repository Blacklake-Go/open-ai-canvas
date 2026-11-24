import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { button, primary, field } from "./controls";
import { workflowError, workflowRequest } from "./api";

export default function WorkflowBuilder({ definition, models, owner, copy, onSaved, onDeleted }) {
  const [draft, setDraft] = useState(() => ({ title: definition.title, steps: definition.steps, revision: definition.revision }));
  const [saved, setSaved] = useState(() => JSON.stringify(draft));
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const nextLocalKey = useRef(0);
  const keyForCreate = useRef(null);
  const dirty = saved !== JSON.stringify(draft);
  const steps = draft.steps;

  function updateSteps(next) {
    setNotice(null);
    setDraft(previous => ({ ...previous, steps: next }));
  }

  function addStep(mode) {
    const step = { mode, modelId: models[mode][0].id, instruction: "", localKey: ++nextLocalKey.current };
    if (mode === "t2t" && steps.at(-1)?.mode === "t2i") {
      updateSteps([...steps.slice(0, -1), step, steps.at(-1)]);
    } else {
      updateSteps([...steps, step]);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setNotice(null);
    setBusy(true);
    try {
      const payload = { title: draft.title, steps: draft.steps.map(({ mode, modelId, instruction }) => ({ mode, modelId, instruction })) };
      if (!definition.id) keyForCreate.current ||= crypto.randomUUID();
      const result = await workflowRequest(owner, definition.id ? "/" + definition.id : "", {
        method: definition.id ? "PUT" : "POST",
        body: definition.id ? { ...payload, revision: draft.revision } : { ...payload, creationKey: keyForCreate.current },
      });
      const nextDraft = { title: result.title, steps: result.steps, revision: result.revision };
      setDraft(nextDraft);
      setSaved(JSON.stringify(nextDraft));
      setNotice({ text: copy.saved });
      onSaved(result);
    } catch (error) {
      setNotice({ error: true, text: workflowError(error, copy) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await workflowRequest(owner, `/${definition.id}?revision=${draft.revision}`, { method: "DELETE" });
      setShowDelete(false);
      onDeleted();
    } catch (error) {
      setShowDelete(false);
      setNotice({ error: true, text: workflowError(error, copy) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-5">
      <fieldset disabled={busy} className="grid gap-5">
        <label className="grid gap-2 text-body-sm font-medium text-ink">
          {copy.name}
          <input className={field} maxLength={120} required value={draft.title}
            onChange={event => { setNotice(null); setDraft(value => ({ ...value, title: event.target.value })); }} />
        </label>
        <p className="text-body-sm text-ink-muted">{copy.stepHelp}</p>
        <ol className="grid gap-3">
          {steps.map((step, index) => (
            <li key={step.localKey === undefined ? `initial-${index}` : `added-${step.localKey}`}
              className="grid gap-3 rounded-xl border border-line-subtle bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-body-sm font-semibold text-ink">{index + 1}. {step.mode === "t2t" ? copy.text : copy.image}</h3>
                <button type="button" className={button} disabled={steps.length <= 1}
                  onClick={() => updateSteps(steps.filter((_, itemIndex) => itemIndex !== index))}>
                  {copy.remove}
                </button>
              </div>
              <label className="grid gap-2 text-body-sm text-ink">
                {copy.model} {index + 1}
                <select aria-label={`${copy.model} ${index + 1}`} className={field} value={step.modelId} required onChange={event => updateSteps(steps.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, modelId: event.target.value } : item))}>
                  {!models[step.mode].some(model => model.id === step.modelId) && (
                    <option value={step.modelId}>{step.modelId} · {copy.modelMissing}</option>
                  )}
                  {models[step.mode].map(model => (
                    <option key={model.id} value={model.id}>{model.displayName || model.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-body-sm text-ink">
                {copy.instruction} {index + 1}
                <textarea aria-label={`${copy.instruction} ${index + 1}`} className={field} rows={2} value={step.instruction} maxLength={2000}
                  onChange={event => updateSteps(steps.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, instruction: event.target.value } : item))} />
              </label>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={steps.length >= 6 || !models.t2t.length}
            onClick={() => addStep("t2t")}>{copy.addText}</button>
          <button type="button" className={button} disabled={steps.length >= 6 || !models.t2i.length || steps.some(step => step.mode === "t2i")}
            onClick={() => addStep("t2i")}>{copy.addImage}</button>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button className={primary} disabled={busy || (!!definition.id && !dirty) || !draft.title.trim()} type="submit">
          {busy ? copy.loading : copy.save}
        </button>
        {definition.id && (
          <Dialog open={showDelete} onOpenChange={open => { if (!busy) setShowDelete(open); }}>
            <DialogTrigger asChild><button className={button} type="button" disabled={busy}>{copy.discard}</button></DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
              <DialogTitle>{copy.deleteTitle}</DialogTitle>
              <DialogDescription>{copy.deleteDescription}</DialogDescription>
              <DialogFooter>
                <button type="button" className={button} disabled={busy} onClick={() => setShowDelete(false)}>{copy.cancel}</button>
                <button type="button" className={button + " text-danger"} disabled={busy} onClick={remove}>{busy ? copy.loading : copy.discard}</button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {notice && <p role={notice.error ? "alert" : "status"} className={notice.error ? "text-danger" : "text-ink-muted"}>{notice.text}</p>}
    </form>
  );
}
