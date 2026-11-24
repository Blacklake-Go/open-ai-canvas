"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/services/api/http";
import { getLocaleConfig } from "@/lib/locales";
import { isServerModelGenerationEligible } from "../models.js";
import { workflowCopy } from "./workflow/copy";
import { workflowError, workflowRequest } from "./workflow/api";
import { button, primary } from "./workflow/controls";
import WorkflowBuilder from "./workflow/WorkflowBuilder";
import WorkflowPlayground from "./workflow/WorkflowPlayground";

const perPage = 25;
const cardClass = "grid content-start gap-3 rounded-xl border border-line-subtle bg-surface p-4";

function WorkflowLibrary({ owner, copy, models, location, router, signedAction, begin }) {
  const mine = location.view === "mine";
  const [page, setPage] = useState(0);
  const list = useQuery({
    queryKey: ["workflow-library", owner, page],
    queryFn: ({ signal }) => workflowRequest(owner, `?offset=${page * perPage}`, { signal }),
    enabled: Boolean(owner && mine),
    retry: false,
  });
  const text = models.t2t[0];
  const image = models.t2i[0];
  const templates = [
    {
      title: copy.promptImage,
      steps: text && image && [
        { mode: "t2t", modelId: text.id, instruction: "Turn the brief into one visual production prompt. Preserve subject, constraints and composition. Return only the finished prompt." },
        { mode: "t2i", modelId: image.id, instruction: "" },
      ],
    },
    {
      title: copy.expandText,
      steps: text && [
        { mode: "t2t", modelId: text.id, instruction: "Develop the idea into a short creative brief. Respond in the language of the input." },
        { mode: "t2t", modelId: text.id, instruction: "Turn the creative brief into a practical shot list. Respond in the language of the brief." },
      ],
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} type="button" aria-pressed={!mine} onClick={() => router.push(location.home)}>
          {copy.templates}
        </button>
        <button className={button} type="button" aria-pressed={mine} onClick={() => router.push(location.mine)}>
          {copy.library}
        </button>
        <button className={primary + " ml-auto"} type="button" disabled={!text && !image} onClick={() => signedAction(() => {
          const model = text || image;
          begin({ title: copy.newWorkflow, steps: [{ mode: text ? "t2t" : "t2i", modelId: model.id, instruction: "" }] });
        })}>
          {copy.newWorkflow}
        </button>
      </div>
      {!mine ? <div className="grid gap-3 sm:grid-cols-2">
        {templates.map(item => (
          <section key={item.title} className={cardClass}>
            <h2 className="text-body-sm font-semibold text-ink">{item.title}</h2>
            {item.steps ? <ol className="flex flex-wrap gap-x-4 gap-y-2 text-body-sm text-ink-muted">
              {item.steps.map((step, index) => <li key={index}>{index + 1}. {step.mode === "t2t" ? copy.text : copy.image}</li>)}
            </ol> : <p className="text-body-sm text-ink-muted">{copy.modelMissing}</p>}
            <div><button className={button} type="button" disabled={!item.steps} onClick={() => signedAction(() => begin(item))}>{copy.useTemplate}</button></div>
          </section>
        ))}
      </div> : !owner ? (
        <section className={cardClass}>
          <p className="text-body-sm text-ink-muted">{copy.signInHint}</p>
          <div><button className={primary} type="button" onClick={() => signedAction(() => {})}>{copy.signIn}</button></div>
        </section>
      ) : list.isPending ? <p role="status" className="text-ink-muted">{copy.loading}</p> :
        list.isError ? <p role="alert" className="text-ink-muted">{copy.loadFailed} <button className={button} onClick={() => list.refetch()}>{copy.retry}</button></p> : (
          <>
            {(!list.data?.length) && <p className="text-ink-muted">{copy.empty}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(list.data || []).map(item => (
                <Link href={`${location.routeRoot}/${item.id}/builder`} key={item.id}
                  className={cardClass + " control-focus min-h-11 transition-colors duration-fast hover:bg-wash"}>
                  <h2 className="break-words text-body-sm font-semibold text-ink">{item.title}</h2>
                  <p className="text-caption text-ink-muted">{copy.savedVersion} {item.revision}</p>
                </Link>
              ))}
            </div>
            {(page > 0 || list.data?.length === perPage) && (
              <div className="flex flex-wrap gap-2">
                <button className={button} type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>{copy.prev}</button>
                <button className={button} type="button" disabled={list.data?.length !== perPage} onClick={() => setPage(value => value + 1)}>{copy.next}</button>
              </div>
            )}
          </>
        )}
    </div>
  );
}

export default function WorkflowStudio({ owner, locale = "en", onRequireAuth, routeId, routeView }) {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const copy = workflowCopy(locale);
  const slug = Array.isArray(params?.tab) ? params.tab : Array.isArray(params?.slug) ? params.slug : [];
  const slugIndex = slug.findIndex(value => value === "workflows" || value === "workflow");
  const id = routeId || params?.id || (slugIndex >= 0 ? slug[slugIndex + 1] : null);
  const view = routeView || (params?.id ? params?.tab : slug[slugIndex + 2]);
  const builder = view === "builder" || view === "editor";
  const localeRoot = getLocaleConfig(locale).rootPath || "";
  const routeRoot = localeRoot + "/workflow";
  const home = localeRoot + "/studio?tab=workflows";
  const mine = home + "&view=mine";
  const [draft, setDraft] = useState(null);
  const directory = useQuery({
    queryKey: ["workflow-models"],
    queryFn: ({ signal }) => apiRequest("/api/models/active", { signal }),
    retry: false,
    staleTime: 30000,
  });
  const definition = useQuery({
    queryKey: ["workflow-definition", owner, id],
    queryFn: ({ signal }) => workflowRequest(owner, "/" + encodeURIComponent(id), { signal }),
    enabled: Boolean(owner && id),
    retry: false,
  });
  const published = (directory.data?.models || []).filter(isServerModelGenerationEligible);
  const models = {
    t2t: published.filter(model => model.category === "text"),
    t2i: published.filter(model => model.category === "image" && model.generationCapabilities?.modes?.includes("t2i")),
  };
  const active = definition.data;

  function signedAction(action) {
    if (owner) action();
    else onRequireAuth?.();
  }

  function saved(result) {
    client.setQueryData(["workflow-definition", owner, result.id], result);
    void client.invalidateQueries({ queryKey: ["workflow-library", owner] });
    if (!id) {
      setDraft(null);
      router.push(`${routeRoot}/${result.id}/builder`);
    }
  }

  function deleted() {
    void client.invalidateQueries({ queryKey: ["workflow-library", owner] });
    void client.invalidateQueries({ queryKey: ["workflow-definition", owner, id], refetchType: "none" });
    router.replace(mine);
  }

  return (
    <main className="h-full min-h-0 w-full overflow-auto text-ink">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6">
        <header className="grid content-start gap-3">
          {(id || draft) && (draft && !id
            ? <button className={button + " w-fit"} type="button" onClick={() => setDraft(null)}>{copy.back}</button>
            : <Link className={button + " w-fit"} href={mine}>{copy.back}</Link>)}
          <h1 className="break-words text-section-title font-semibold">{active?.title || draft?.title || copy.title}</h1>
          {active && (
            <nav className="flex flex-wrap gap-2" aria-label={copy.title}>
              <Link className={button} aria-current={builder ? "page" : undefined} href={`${routeRoot}/${active.id}/builder`}>{copy.builder}</Link>
              <Link className={button} aria-current={!builder ? "page" : undefined} href={`${routeRoot}/${active.id}/playground`}>{copy.playground}</Link>
            </nav>
          )}
        </header>
        {directory.isError && <p role="alert" className="text-ink-muted">{copy.modelMissing} <button className={button} onClick={() => directory.refetch()}>{copy.retry}</button></p>}
        {id && !owner && <section className={cardClass}>
          <p className="text-body-sm text-ink-muted">{copy.signInHint}</p>
          <div><button className={primary} type="button" onClick={onRequireAuth}>{copy.signIn}</button></div>
        </section>}
        {id && owner && definition.isPending && <p role="status" className="text-ink-muted">{copy.loading}</p>}
        {id && owner && definition.isError && <p role="alert" className="text-ink-muted">{workflowError(definition.error, copy)}
          {definition.error?.status !== 404 && <button className={button} onClick={() => definition.refetch()}>{copy.retry}</button>}
        </p>}
        {active && !builder && <WorkflowPlayground key={active.id} owner={owner} definition={active}
          copy={copy} models={models} router={router} routeRoot={routeRoot} runId={search?.get("run")} locale={locale} />}
        {(active && builder || !id && draft) && (
          <WorkflowBuilder key={active?.id || "draft"} owner={owner} definition={active || draft} models={models}
            copy={copy} onSaved={saved} onDeleted={deleted} />
        )}
        {!id && !draft && <WorkflowLibrary owner={owner} copy={copy} models={models}
          location={{ home, mine, routeRoot, view: search?.get("view") }} router={router} signedAction={signedAction} begin={setDraft} />}
      </div>
    </main>
  );
}
