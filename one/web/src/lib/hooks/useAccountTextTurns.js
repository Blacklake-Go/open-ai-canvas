import { useEffect, useRef, useState } from "react";
import { availableTextModels, isServerModelGenerationEligible } from "@/packages/studio/src/models.js";
import { submitPlatformGeneration } from "@/packages/studio/src/platformGeneration.js";
import { getRiverCopy } from "@/components/generation-river/copy";
import { normalizeLocale } from "@/lib/locales";

const inFlight = turn => turn.status === "queued" || turn.status === "processing";

export function useAccountTextTurns({ enabled, owner, sessionId, jobsPath, studioPrefix, locale, preferredModel }) {
  const [models, setModels] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [modelId, setModelId] = useState("");
  const [record, setRecord] = useState(null);
  const [refresh, refreshTurns] = useState(0);
  const [accepted, setAccepted] = useState(null);
  const pendingRequest = useRef(null);
  const intent = useRef(null);
  const copy = getRiverCopy(normalizeLocale(locale));

  useEffect(() => {
    if (!enabled || !owner) return;
    const controller = new AbortController();
    fetch("/api/models/active?nocache=1", { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(copy.loadError);
        return response.json();
      })
      .then(data => {
        if (controller.signal.aborted) return;
        const available = availableTextModels(data.models);
        setCatalog(data.models.filter(isServerModelGenerationEligible));
        setModels(available);
        setModelId(previous => available.some(model => model.id === previous) ? previous : available[0]?.id || "");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCatalog([]);
          setModels([]);
        }
      });
    return () => controller.abort();
  }, [enabled, owner, copy.loadError]);

  useEffect(() => {
    const canonical = { "deepseek-chat": "deepseek-v3", "deepseek-reasoner": "deepseek-r1" }[preferredModel] || preferredModel;
    if (canonical && models) setModelId(models.some(model => model.id === canonical) ? canonical : "");
  }, [models, preferredModel]);

  useEffect(() => {
    if (!enabled || !owner || !sessionId || !jobsPath) return;
    const controller = new AbortController();
    let timer;
    async function read() {
      try {
        const response = await fetch(jobsPath, {
          signal: controller.signal,
          headers: { "X-ONE-Expected-User": String(owner) },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(copy.loadError);
        const jobs = await response.json();
        if (controller.signal.aborted) return;
        setRecord({ owner, sessionId, jobs, error: false });
        setAccepted(previous => previous?.owner === owner && jobs.some(job => job.id === previous.id) ? null : previous);
        if (jobs.some(inFlight)) timer = setTimeout(read, 2400);
      } catch {
        if (controller.signal.aborted) return;
        setRecord(previous => ({
          owner, sessionId, error: true,
          jobs: previous?.owner === owner && previous.sessionId === sessionId ? previous.jobs : [],
        }));
      }
    }
    void read();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, owner, sessionId, jobsPath, refresh, copy.loadError]);

  const recordInScope = record && record.owner === owner && record.sessionId === sessionId;
  const jobs = recordInScope ? record.jobs : [];
  const turns = accepted && accepted.owner === owner && accepted.sessionId === sessionId && !jobs.some(job => job.id === accepted.id)
    ? [...jobs, accepted] : jobs;
  const waiting = turns.some(inFlight);
  const historyError = recordInScope && record.error;
  const model = models?.find(item => item.id === modelId);

  async function submit(id, prompt, media) {
    if (pendingRequest.current) return pendingRequest.current;
    const selected = media?.model || model;
    if (!selected) throw new Error(copy.loadError);
    const parameters = media ? { ...media.parameters, prompt } : { task_type: "t2t" };
    const fingerprint = JSON.stringify([owner, id, selected.id, prompt, parameters]);
    if (intent.current?.fingerprint !== fingerprint) {
      intent.current = { fingerprint, key: crypto.randomUUID() };
    }
    const job = submitPlatformGeneration({
      modelId: selected.id,
      ownerUserId: owner,
      studioId: `${studioPrefix}:${id}`,
      prompt,
      parameters,
      confirmQuote: media?.confirmQuote,
      idempotencyKey: intent.current.key,
      returnOnQueue: true,
    }).then(result => {
      intent.current = null;
      setAccepted({ owner, sessionId: id, id: result.id, status: result.status, prompt, model: selected.id, mode: parameters.task_type, credits: result.credits, createdAt: new Date().toISOString() });
      refreshTurns(previous => previous + 1);
    }).catch(error => {
      if (error.code === "GENERATION_QUOTE_DECLINED" || (error.status && error.status < 500)) intent.current = null;
      if (error.code?.endsWith("_TURN_PENDING")) refreshTurns(previous => previous + 1);
      throw error;
    }).finally(() => { pendingRequest.current = null; });
    pendingRequest.current = job;
    return job;
  }

  const messages = turns.flatMap(job => {
    const status = job.status === "processing" ? "running" : job.status === "cancelled" ? "canceled" : job.status;
    return [
      { id: `${job.id}:user`, role: "user", content: job.prompt, timestamp: job.createdAt },
      { id: `${job.id}:assistant`, role: "assistant", content: job.resultText || job.error || copy[status] || copy.checking, timestamp: job.createdAt, jobStatus: status, assetId: job.assetId, mode: job.mode },
    ];
  });

  return {
    copy, models, catalog, modelId, setModelId, model, messages, waiting, historyError, submit,
    refresh: () => refreshTurns(value => value + 1),
  };
}
