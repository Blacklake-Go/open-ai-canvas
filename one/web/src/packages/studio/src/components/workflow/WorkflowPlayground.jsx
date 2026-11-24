import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { button, primary, field } from "./controls";
import { workflowError, workflowRequest } from "./api";
import WorkflowAutomation from "./WorkflowAutomation";

const active = status => status === "queued" || status === "processing";
const jobLabel = index => `workflow-step-${index + 1}`;

function RunSteps({ owner, copy, run, refresh, models, locale }) {
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelQuote = useRef(null);
  const requestStep = useRef(null);
  const jobs = new Map((run.jobs || []).map(job => [job.label, job]));
  const automationActive = run.automationState === "active";
  const nextReady = run.steps.some((_, index) => !jobs.has(jobLabel(index)) &&
    (index === 0 || (jobs.get(jobLabel(index - 1))?.status === "succeeded" && jobs.get(jobLabel(index - 1)).resultText?.trim())));
  const keys = { queued: copy.queued, processing: copy.running, succeeded: copy.succeeded, failed: copy.failedStep, cancelled: copy.failedStep };
  useEffect(() => {
    if (quote) cancelQuote.current?.focus();
  }, [quote]);

  function decline() {
    setQuote(null);
    requestAnimationFrame(() => requestStep.current?.focus());
  }

  async function perform(index, proposed) {
    if (busy) return;
    setBusy(true);
    setError("");
    const path = `/runs/${run.id}/steps/${index}`;
    try {
      if (!proposed) {
        const result = await workflowRequest(owner, path + "/quote", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
        if (result.job) await refresh();
        else setQuote({ ...result, index });
      } else {
        await workflowRequest(owner, path, { method: "POST", body: { quoteId: proposed.quoteId } });
        setQuote(null);
        await refresh();
      }
    } catch (failure) {
      setError(workflowError(failure, copy));
      if (proposed) setQuote(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3">
      <div className="rounded-xl border border-line-subtle bg-surface p-4">
        <p className="text-caption text-ink-muted">{copy.savedVersion} {run.revision}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-body-sm text-ink">{run.input}</p>
      </div>
      <WorkflowAutomation owner={owner} run={run} refresh={refresh} ready={nextReady} locale={locale} copy={copy} models={models} />
      <ol className="grid gap-3">
        {run.steps.map((step, index) => {
          const job = jobs.get(jobLabel(index));
          const previous = jobs.get(jobLabel(index - 1));
          const ready = !job && (index === 0 || (previous?.status === "succeeded" && previous.resultText?.trim()));
          const proposal = !automationActive && quote?.index === index ? quote : null;
          const model = models[step.mode].find(item => item.id === step.modelId);
          const media = job?.assetId ? `/api/assets/${encodeURIComponent(job.assetId)}/download?inline=1` : null;
          return (
            <li key={jobLabel(index)} data-workflow-step={index + 1} data-workflow-status={job?.status || (ready ? "ready" : "waiting")}
              className="grid gap-3 rounded-xl border border-line-subtle bg-surface p-4">
              <div className="flex flex-wrap justify-between gap-2 text-body-sm">
                <h3 className="font-semibold text-ink">{index + 1}. {step.mode === "t2t" ? copy.text : copy.image}</h3>
                <span className="break-all text-ink-muted">{model?.displayName || model?.name || step.modelId}</span>
              </div>
              {step.instruction && <p className="break-words whitespace-pre-wrap text-body-sm text-ink-muted">{step.instruction}</p>}
              {job ? <p role="status" className="text-body-sm text-ink">{keys[job.status] || copy.running} · {job.credits} {copy.credits}</p> :
                ready && !proposal && !automationActive ? <div><button ref={requestStep} className={primary} type="button" disabled={busy}
                  onClick={() => perform(index, null)}>{busy ? copy.loading : copy.quote}</button></div> :
                !proposal && <p className="text-body-sm text-ink-muted">{copy.waiting}</p>}
              {proposal && (
                <div className="flex flex-wrap items-center gap-2" onKeyDown={event => {
                  if (event.key === "Escape" && !busy) { event.preventDefault(); decline(); }
                }}>
                  <p role="status" className="mr-auto text-body-sm text-ink">{proposal.credits} {copy.credits}</p>
                  <button ref={cancelQuote} className={button} disabled={busy} type="button" onClick={decline}>{copy.cancel}</button>
                  <button className={primary} disabled={busy} type="button" onClick={() => perform(index, proposal)}>{copy.confirm}</button>
                </div>
              )}
              {job?.error && <p role="alert" className="break-words text-body-sm text-danger">{job.error}</p>}
              {job?.resultText && <p className="break-words whitespace-pre-wrap text-body-sm text-ink">{job.resultText}</p>}
              {media && <a className="control-focus w-fit text-ink" href={media} target="_blank" rel="noreferrer">
                <img alt={copy.open} src={media} className="mb-2 max-h-72 max-w-full rounded-lg object-contain" />
                {copy.open}
              </a>}
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </section>
  );
}

export default function WorkflowPlayground({ owner, definition, copy, models, router, routeRoot, runId, locale }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const intent = useRef(null);
  const path = `${routeRoot}/${definition.id}/playground`;
  const runs = useQuery({
    queryKey: ["workflow-runs", owner, definition.id],
    queryFn: ({ signal }) => workflowRequest(owner, `/${definition.id}/runs`, { signal }),
    retry: false,
  });
  const current = useQuery({
    queryKey: ["workflow-run", owner, runId],
    queryFn: ({ signal }) => workflowRequest(owner, `/runs/${encodeURIComponent(runId)}`, { signal }),
    enabled: Boolean(runId),
    retry: false,
    refetchInterval: query => query.state.data?.automationState === "active" || query.state.data?.jobs?.some(job => active(job.status)) ? 1500 : false,
  });

  async function createRun(event) {
    event.preventDefault();
    const raw = input.trim();
    if (!raw || busy) return;
    if (intent.current?.input !== raw || intent.current.revision !== definition.revision) {
      intent.current = { input: raw, revision: definition.revision, key: crypto.randomUUID() };
    }
    setBusy(true);
    setError("");
    try {
      const run = await workflowRequest(owner, `/${definition.id}/runs`, {
        method: "POST", body: { revision: definition.revision, input: raw, creationKey: intent.current.key },
      });
      intent.current = null;
      setInput("");
      void runs.refetch();
      router.push(path + "?run=" + encodeURIComponent(run.id));
    } catch (failure) {
      setError(workflowError(failure, copy));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
      <aside className="grid content-start gap-4">
        <form onSubmit={createRun} className="grid gap-2">
          <label className="grid gap-2 text-body-sm font-medium text-ink">
            {copy.input}
            <textarea className={field} required rows={4} maxLength={2000} value={input} disabled={busy}
              onChange={event => setInput(event.target.value)} />
          </label>
          <button className={primary} disabled={busy || !input.trim()} type="submit">{busy ? copy.loading : copy.start}</button>
          {error && <p role="alert" className="text-danger">{error}</p>}
        </form>
        <div className="grid gap-2">
          <h3 className="text-body-sm font-semibold text-ink">{copy.history}</h3>
          {runs.isPending && <p role="status" className="text-ink-muted">{copy.loading}</p>}
          {runs.isError && <p role="alert" className="text-ink-muted">{copy.loadFailed} <button className={button} onClick={() => runs.refetch()}>{copy.retry}</button></p>}
          {(runs.data || []).map(run => (
            <Link key={run.id} className={button + " justify-start break-words text-left"} aria-current={run.id === runId ? "page" : undefined}
              href={path + "?run=" + encodeURIComponent(run.id)}>
              {run.input}
            </Link>
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        {runId && current.isPending && <p role="status" className="text-ink-muted">{copy.loading}</p>}
        {runId && current.isError && <p role="alert" className="text-ink-muted">{workflowError(current.error, copy)} <button className={button} onClick={() => current.refetch()}>{copy.retry}</button></p>}
        {current.data?.workflowId === definition.id && (
          <RunSteps key={current.data.id} owner={owner} run={current.data} copy={copy} refresh={current.refetch} models={models} locale={locale} />
        )}
        {current.data && current.data.workflowId !== definition.id && <p role="alert" className="text-ink-muted">{copy.unavailable}</p>}
      </div>
    </div>
  );
}
