import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { button, primary } from "./controls";
import { workflowError, workflowRequest } from "./api";
import { automationCopy } from "./copy";

export default function WorkflowAutomation({ owner, run, refresh, ready, locale, copy, models }) {
  const text = automationCopy(locale);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestButton = useRef(null);
  const cancelButton = useRef(null);
  const statusRef = useRef(null);
  const base = `/runs/${run.id}/automatic`;
  const active = run.automationState === "active";
  const stopped = run.automationState === "stopped";
  const completed = run.automationState === "completed";

  async function perform(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (action === "quote") {
        const proposed = await workflowRequest(owner, base + "/quote", { method: "POST" });
        setQuote(proposed);
      } else {
        await workflowRequest(owner, base, action === "confirm"
          ? { method: "POST", body: { quoteId: quote.quoteId } }
          : { method: "DELETE" });
        setQuote(null);
        await refresh();
      }
    } catch (failure) {
      setError(statusMessage(failure.code, text, copy) || workflowError(failure, copy));
      setQuote(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const status = active ? text.active : completed ? text.completed : stopped ?
    statusMessage(run.automationError, text, copy) || text.stopped : null;
  if (!ready && !status) return null;

  return (
    <div className="grid gap-3 rounded-xl border border-line-subtle bg-surface p-4" data-workflow-automation={run.automationState}>
      {status && <p ref={statusRef} tabIndex={-1} role="status" className="text-body-sm text-ink">{status}</p>}
      <div className="flex flex-wrap gap-2">
        {active && <button type="button" className={button} disabled={busy} onClick={() => perform("stop")}>
          {busy ? copy.loading : text.stop}
        </button>}
        {!active && !completed && ready &&
          <button ref={requestButton} type="button" className={primary} disabled={busy} onClick={() => perform("quote")}>
            {busy ? copy.loading : text.quote}
          </button>}
      </div>
      {error && <p role="alert" className="text-body-sm text-danger">{error}</p>}
      <Dialog open={Boolean(quote)} onOpenChange={open => { if (!open && !busy) setQuote(null); }}>
        {quote && (
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg"
            onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
            onPointerDownOutside={event => { if (busy) event.preventDefault(); }}
            onOpenAutoFocus={event => { event.preventDefault(); cancelButton.current?.focus(); }}
            onCloseAutoFocus={event => {
              event.preventDefault();
              requestAnimationFrame(() => (requestButton.current || statusRef.current)?.focus());
            }}>
            <DialogTitle>{text.title}</DialogTitle>
            <DialogDescription>{text.detail}</DialogDescription>
            <ol className="grid gap-2 text-body-sm text-ink">
              {run.steps.slice(quote.startStep).map((step, offset) => {
                const index = offset + quote.startStep;
                const model = models[step.mode].find(item => item.id === step.modelId);
                return (
                  <li key={index} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words">{index + 1}. {model?.displayName || model?.name || step.modelId}</span>
                    <span>{quote.stepCaps[index]} {copy.credits}</span>
                  </li>
                );
              })}
            </ol>
            <p className="border-t border-line-subtle pt-3 text-body-sm font-semibold text-ink">
              {text.maximum} · {quote.maxCredits} {copy.credits}
            </p>
            <DialogFooter>
              <button ref={cancelButton} type="button" className={button} disabled={busy} onClick={() => setQuote(null)}>{copy.cancel}</button>
              <button type="button" className={primary} disabled={busy} onClick={() => perform("confirm")}>
                {busy ? copy.loading : text.confirm}
              </button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function statusMessage(code, text, copy) {
  switch (code) {
    case "WORKFLOW_USER_STOPPED": return text.stopped;
    case "WORKFLOW_PRICE_CHANGED": return text.priceChanged;
    case "WORKFLOW_AUTO_QUOTE_EXPIRED": return text.expired;
    case "WORKFLOW_AUTO_ACTIVE": return text.active;
    case "WORKFLOW_AUTO_NOT_READY": return copy.waiting;
    case "WORKFLOW_RATE_LIMITED": return text.limited;
    case "WORKFLOW_STEP_FAILED": return text.failed;
    case "WORKFLOW_MODEL_UNAVAILABLE":
    case "MODEL_NOT_AVAILABLE":
    case "MODEL_PRICING_UNCONFIGURED": return copy.modelMissing;
    case "INSUFFICIENT_CREDITS": return copy.creditError;
    default: return "";
  }
}
