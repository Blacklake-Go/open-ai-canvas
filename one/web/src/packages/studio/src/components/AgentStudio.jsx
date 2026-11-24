"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { agentPersona, agentPath } from "@/services/api/agent-persona";
import { useAccountTextTurns } from "@/lib/hooks/useAccountTextTurns";
import en from "../messages/en/agentStudio.json";
import zh from "../messages/zh/agentStudio.json";
import ja from "../messages/ja-JP/agentStudio.json";
import ko from "../messages/ko-KR/agentStudio.json";
import zhTw from "../messages/zh-TW/agentStudio.json";
import es from "../messages/es/agentStudio.json";
import { resolveCopy } from "../i18nUtils";
import { PromptInputField } from "./prompt/PromptInputField.jsx";

const AGENT_MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es: es,
  'es-ES': es,
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateStr, copy) {
  if (!dateStr) return "";
  const utcStr =
    dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
  const diff = Math.floor((Date.now() - new Date(utcStr)) / 1000);
  if (diff < 60) return copy.time.justNow;
  if (diff < 3600) return copy.time.minutesAgo.replace("{n}", Math.floor(diff / 60));
  if (diff < 86400) return copy.time.hoursAgo.replace("{n}", Math.floor(diff / 3600));
  if (diff < 604800) return copy.time.daysAgo.replace("{n}", Math.floor(diff / 86400));
  return new Date(utcStr).toLocaleDateString();
}

// ─── Agent Card (grid) ───────────────────────────────────────────────────────
function AgentCard({ agent, onClick, onEdit, copy }) {
  return (
    <div className="group relative aspect-[4/5] rounded-xl cursor-pointer">
      <button type="button" aria-label={agent.name}
        onClick={() => onClick(agent)}
        className="control-focus absolute inset-0 w-full rounded-xl overflow-hidden border border-line bg-surface text-left transition-[border-color,transform] duration-fast ease-standard hover:border-brand-line shadow-elevation-2"
      >
        {agent.icon_url ? (
          <img
            src={agent.icon_url}
            alt={agent.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-brand-soft flex items-center justify-center text-brand">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-surface/95 p-4">
          <div className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1 opacity-80">
            {agent.category || copy.card.defaultCategory}
          </div>
          <h3 className="text-body-sm font-semibold text-ink truncate group-hover:text-brand transition-colors">
            {agent.name || copy.card.unnamedAgent}
          </h3>
          {agent.description && <p className="mt-1 line-clamp-2 text-caption text-ink-muted">{agent.description}</p>}
          {agent.owner_username && (
            <p className="text-[9px] text-white/40 mt-1 uppercase tracking-tighter font-black">
              {copy.card.byPrefix} {agent.owner_username}
            </p>
          )}
        </div>
      </button>
      
      {onEdit && (
        <button
          type="button"
          aria-label={copy.editor.edit + " " + agent.name}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(agent);
          }}
          className="control-focus absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full border border-line bg-raised text-ink hover:bg-brand hover:text-ink-on-accent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Conversation Card (My Chats) ────────────────────────────────────────────
function ConversationCard({ conv, onClick, copy }) {
  const displayTitle = conv.title || copy.card.newChat;
  const agentSlug = conv.agent_slug || conv.agent_id;
  return (
    <button type="button"
      onClick={() => onClick(agentSlug, conv.id)}
      className="control-focus group flex flex-col gap-3 bg-surface border border-line rounded-xl p-4 text-left hover:border-brand-line hover:bg-wash transition-[border-color,background-color] duration-fast ease-standard"
    >
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/5 shrink-0">
          {conv.agent_icon_url ? (
            <img src={conv.agent_icon_url} alt={conv.agent_name || "Agent"} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-brand uppercase tracking-wider truncate">
            {conv.agent_name || copy.card.unknownAgent}
          </p>
          <p className="text-body-sm font-semibold text-ink truncate" title={displayTitle}>
            {displayTitle}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center justify-between pt-2 border-t border-line mt-auto text-caption text-ink-muted">
        <span>{timeAgo(conv.updated_at, copy)}</span>
        {conv.message_count != null && <span>{conv.message_count} {copy.card.msgsSuffix}</span>}
      </div>
    </button>
  );
}

// Conversation history entries can carry `content` as a plain string or as a
// list of structured blocks (matches the shape agent_router.py's own last-message
// preview extraction already assumes for the "My Chats" list).
function textFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b === "string" ? b : b?.text || "")).join("\n");
  }
  return "";
}

function ChatBubble({ message }) {
  const isUser = message.role === "user";
  const text = textFromContent(message.content);
  return (
    <div data-agent-turn-status={message.jobStatus} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-brand text-ink-on-accent font-medium"
            : "bg-surface border border-line text-ink"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{text}</span>
        ) : (
          <div className="prose dark:prose-invert prose-sm max-w-none break-words prose-p:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || "…"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
const TABS = ["templates", "my-agents", "my-chats"];

export default function AgentStudio({
  owner,
  locale = "en",
  onRequireAuth,
  initialModel = "",
  isHeaderVisible = true,
  onToggleHeader,
}) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const copy = resolveCopy(en, AGENT_MESSAGES, locale);

  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("view");
  const activeMainTab = TABS.includes(requestedTab) ? requestedTab : "templates";
  const [retryCount, setRetryCount] = useState(0);

  const [listing, setListing] = useState({ items: [], loading: true, error: null });
  const tabSegments = Array.isArray(params?.slug) ? params.slug : [];
  const agentsIdx = tabSegments.indexOf("agents");
  const create = pathname.replace(/\/$/, "").endsWith("/agents/create");
  const editSlug = pathname.includes("/agents/edit/") ? params.id : null;
  const agentSlug = editSlug || params.agent_id || (agentsIdx < 0 ? null : tabSegments[agentsIdx + 1]);
  const conversationId = params.conversation_id || (agentsIdx < 0 ? null : tabSegments[agentsIdx + 2]);
  const view = create ? "create" : editSlug ? "edit" : agentSlug ? "chat" : "list";
  const [profile, setProfile] = useState(null);
  const activeAgent = profile?.slug === agentSlug ? profile.agent : null;
  const chatLoading = Boolean(agentSlug) && profile?.slug !== agentSlug;
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [createForm, setCreateForm] = useState({ name: "", description: "", system_prompt: "", welcome_message: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const creationKey = useRef(null);
  const conversationDraft = useRef(null);
  const requestedModel = searchParams.get("model") || initialModel;
  const modelQuery = requestedModel ? "?model=" + encodeURIComponent(requestedModel) : "";
  const textTurns = useAccountTextTurns({
    enabled: view === "chat", owner, sessionId: conversationId, locale,
    jobsPath: agentSlug && conversationId ? agentPath(agentSlug) + "/conversations/" + encodeURIComponent(conversationId) + "/jobs" : null,
    studioPrefix: "agent-chat",
    preferredModel: requestedModel,
  });

  const selectTab = tab => {
    const next = new URLSearchParams(searchParams);
    if (tab === "templates") next.delete("view");
    else next.set("view", tab);
    router.replace(pathname + (next.size ? "?" + next.toString() : ""), { scroll: false });
  };
  const openProfile = agent => router.push("/agents/" + encodeURIComponent(agent.agent_id) + modelQuery);
  const editProfile = agent => router.push("/agents/edit/" + encodeURIComponent(agent.agent_id) + modelQuery);
  const openConversation = (slug, id) => router.push("/agents/" + encodeURIComponent(slug) + "/" + encodeURIComponent(id) + modelQuery);

  useEffect(() => {
    if (!agentSlug) return;
    const controller = new AbortController();
    agentPersona.profile(owner, agentSlug, controller.signal).then(agent => {
      if (controller.signal.aborted) return;
      setProfile({ slug: agentSlug, agent });
      if (editSlug && !agent.is_template) {
        setCreateForm({
          name: agent.name,
          description: agent.description,
          system_prompt: agent.system_prompt,
          welcome_message: agent.welcome_message,
        });
      }
    }).catch(error => {
      if (!controller.signal.aborted) setProfile({ slug: agentSlug, agent: null, error: error.message });
    });
    return () => controller.abort();
  }, [owner, agentSlug, editSlug]);

  useEffect(() => {
    if (view !== "list") return;
    const controller = new AbortController();
    setListing({ items: [], loading: true, error: null });
    const load = activeMainTab === "templates" ? agentPersona.templates(controller.signal)
      : !owner ? Promise.resolve([])
      : activeMainTab === "my-agents" ? agentPersona.profiles(owner, controller.signal)
      : agentPersona.conversations(owner, controller.signal);
    load.then(items => {
      if (!controller.signal.aborted) setListing({ items, loading: false, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setListing({ items: [], loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [owner, view, activeMainTab, retryCount]);

  async function handleSendMessage() {
    const message = chatInput.trim();
    if (!owner || !activeAgent || !message || !textTurns.model || sending || textTurns.waiting || textTurns.historyError) return;
    setSending(true);
    setChatError(null);
    try {
      let id = conversationId;
      if (!id) {
        if (conversationDraft.current?.slug !== agentSlug) {
          conversationDraft.current = { slug: agentSlug, creationKey: crypto.randomUUID(), title: [...message].slice(0, 120).join("") };
        }
        const saved = await agentPersona.openConversation(owner, agentSlug, {
          creationKey: conversationDraft.current.creationKey, title: conversationDraft.current.title,
        });
        id = saved.id;
        if (!id) throw new Error(copy.errors.sendFailed);
      }
      await textTurns.submit(id, message);
      setChatInput("");
      if (!conversationId) {
        conversationDraft.current = null;
        router.replace("/agents/" + encodeURIComponent(agentSlug) + "/" + encodeURIComponent(id) + "?model=" + encodeURIComponent(textTurns.modelId), { scroll: false });
      }
    } catch (error) {
      setChatError(error.message || copy.errors.sendFailed);
    } finally {
      setSending(false);
    }
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();
    if (!owner) {
      onRequireAuth?.();
      return;
    }
    if (creating || !createForm.name.trim() || !createForm.system_prompt.trim()) return;
    if (editSlug && (!activeAgent || activeAgent.is_template)) return;
    setCreating(true);
    setCreateError(null);
    try {
      creationKey.current ||= crypto.randomUUID();
      const result = editSlug
        ? await agentPersona.update(owner, editSlug, { ...createForm, revision: activeAgent.revision })
        : await agentPersona.create(owner, { ...createForm, creationKey: creationKey.current });
      openProfile(result);
    } catch (error) {
      setCreateError(error.code === "AGENT_REVISION_CONFLICT" ? copy.editor.conflict : error.message || copy.errors.createFailed);
    } finally {
      setCreating(false);
    }
  }

  const { items, loading, error } = listing;
  const chatMessages = textTurns.messages;
  const listPath = activeAgent && !activeAgent.is_template ? "/agents?view=my-agents" : "/agents";
  const canEdit = Boolean(owner && activeAgent && !activeAgent.is_template);
  // ── Render: Create ───────────────────────────────────────────────────────────
  if (view === "create" || view === "edit") {
    return (
      <div className="h-full min-w-0 flex flex-col bg-transparent text-ink overflow-y-auto custom-scrollbar">
        <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-4 border-b border-line bg-surface/80 px-4 sm:px-8">
          <button
            onClick={() => router.push(listPath)}
            className="control-focus flex min-h-11 items-center gap-2 rounded-lg text-label text-ink-muted hover:text-ink transition-colors"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {copy.buttons.back}
          </button>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-brand">{editSlug ? copy.editor.edit : copy.headings.createAgent}</h2>
        </div>

        <form onSubmit={handleCreateSubmit} className="max-w-2xl w-full mx-auto space-y-6 p-4 sm:p-8">
          {editSlug && (chatLoading || !canEdit) && (
            <p role={chatLoading ? "status" : "alert"} className="text-body-sm text-ink-muted">
              {chatLoading ? textTurns.copy.loading : profile?.error || copy.errors.loadAgentFailed}
            </p>
          )}
          <fieldset className="space-y-4" disabled={creating || Boolean(editSlug && !canEdit)}>
          <div className="space-y-2">
            <label htmlFor="agent-editor-name" className="block text-label text-ink-muted">{copy.labels.name}</label>
            <input
              type="text"
              required
              id="agent-editor-name"
              maxLength={120}
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={copy.placeholders.name}
              className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand transition-[border-color,box-shadow] duration-fast ease-standard"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="agent-editor-description" className="block text-label text-ink-muted">{copy.labels.description}</label>
            <input
              type="text"
              id="agent-editor-description"
              maxLength={1000}
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={copy.placeholders.description}
              className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand transition-[border-color,box-shadow] duration-fast ease-standard"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="agent-editor-system-prompt" className="block text-label text-ink-muted">{copy.labels.systemPrompt}</label>
            <textarea
              required
              id="agent-editor-system-prompt"
              maxLength={12000}
              value={createForm.system_prompt}
              onChange={(e) => setCreateForm((f) => ({ ...f, system_prompt: e.target.value }))}
              placeholder={copy.placeholders.systemPrompt}
              className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand transition-[border-color,box-shadow] duration-fast ease-standard min-h-[140px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="agent-editor-welcome" className="block text-label text-ink-muted">{copy.labels.welcomeMessage}</label>
            <input
              type="text"
              id="agent-editor-welcome"
              maxLength={1000}
              value={createForm.welcome_message}
              onChange={(e) => setCreateForm((f) => ({ ...f, welcome_message: e.target.value }))}
              placeholder={copy.placeholders.welcomeMessage}
              className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand transition-[border-color,box-shadow] duration-fast ease-standard"
            />
          </div>

          </fieldset>
          {createError && (
            <p role="alert" className="text-body-sm text-danger">{createError}</p>
          )}

          <button
            type="submit"
            disabled={creating || !createForm.name.trim() || !createForm.system_prompt.trim() || Boolean(editSlug && !canEdit)}
            className="w-full py-3.5 bg-brand text-ink-on-accent text-xs font-semibold uppercase tracking-[0.2em] rounded-xl hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant transition-[background-color,transform] duration-fast ease-standard disabled:pointer-events-none disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring flex items-center justify-center gap-3"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                <span>{copy.buttons.creating}</span>
              </>
            ) : (
              <span>{editSlug ? copy.editor.save : copy.buttons.createAgentSubmit}</span>
            )}
          </button>
        </form>
      </div>
    );
  }

  // ── Render: Chat ─────────────────────────────────────────────────────────────
  if (view === "chat") {
    return (
      <div className="h-full min-w-0 flex flex-col bg-transparent text-ink">
        <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface/80 px-4 sm:px-8">
          <button
            onClick={() => router.push(listPath)}
            className="control-focus flex min-h-11 items-center gap-2 rounded-lg text-label text-ink-muted hover:text-ink transition-colors"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {copy.buttons.back}
          </button>
          <div className="h-4 w-[1px] bg-white/10" />
          {activeAgent && (
            <div className="flex items-center gap-3">
              {activeAgent.icon_url && (
                <div className="size-8 overflow-hidden rounded-lg border border-line bg-surface">
                  <img src={activeAgent.icon_url} alt={activeAgent.name} className="w-full h-full object-cover" />
                </div>
              )}
              <span className="text-body-sm font-semibold text-ink">{activeAgent.name}</span>
            </div>
          )}
          {canEdit && <button type="button" onClick={() => editProfile(activeAgent)} className="control-focus min-h-11 rounded-lg px-3 text-label text-ink-muted hover:bg-wash">{copy.editor.edit}</button>}
          {conversationId && activeAgent && <button type="button" onClick={() => openProfile(activeAgent)} className="control-focus min-h-11 rounded-lg px-3 text-label text-ink-muted hover:bg-wash">{copy.editor.newChat}</button>}
        </div>
        <div role="log" aria-live="polite" className="flex-1 overflow-y-auto custom-scrollbar space-y-4 p-4 sm:p-8 max-w-3xl w-full mx-auto">
          {chatLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-white/5 border-t-brand rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {chatMessages.length === 0 && activeAgent?.welcome_message && (
                <ChatBubble message={{ role: "assistant", content: activeAgent.welcome_message }} />
              )}
              {chatMessages.map(msg => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-surface border border-line rounded-2xl px-4 py-3">
                    <div className="w-4 h-4 border-2 border-line-subtle border-t-brand rounded-full animate-spin" />
                  </div>
                </div>
              )}
              {(chatError || profile?.error) && (
                <p role="alert" className="text-body-sm text-danger">{chatError || profile.error}</p>
              )}
              {textTurns.historyError && (
                <div role="alert" className="text-body-sm text-danger">
                  {textTurns.copy.loadError}
                  <button type="button" onClick={textTurns.refresh} className="control-focus min-h-11 px-3">{copy.buttons.retry}</button>
                </div>
              )}
              {!owner && onRequireAuth && (
                <button type="button" onClick={onRequireAuth} className="control-focus min-h-11 rounded-lg bg-brand px-4 font-medium text-ink-on-accent">
                  {copy.auth.cta}
                </button>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-line bg-surface/80 p-4 sm:p-6">
          {owner && textTurns.models && (
            <div className="mx-auto mb-3 max-w-3xl">
              {textTurns.models.length ? (
                <div className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
                  <label htmlFor="agent-chat-model">{copy.editor.model}</label>
                  <select id="agent-chat-model" value={textTurns.modelId} onChange={event => textTurns.setModelId(event.target.value)}
                    aria-describedby={!textTurns.modelId ? "agent-model-unavailable" : undefined}
                    className="control-focus min-h-11 max-w-full rounded-lg border border-line bg-raised px-2 text-body-sm text-ink">
                    {!textTurns.modelId && <option value="" disabled>{copy.editor.model}</option>}
                    {textTurns.models.map(model => (
                      <option key={model.id} value={model.id}>{model.displayName || model.name} · {model.creditsPrice} {copy.editor.credits}</option>
                    ))}
                  </select>
                  {!textTurns.modelId && <p id="agent-model-unavailable" role="status" className="w-full">{copy.editor.chooseModel}</p>}
                </div>
              ) : <p role="status" className="text-body-sm text-ink-muted">{copy.editor.unavailable}</p>}
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="max-w-3xl w-full mx-auto flex items-end gap-3"
          >
            <PromptInputField
              className="min-w-0 flex-1"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onEnter={handleSendMessage}
              disabled={!owner || !activeAgent}
              placeholder={copy.placeholders.chatInput}
              rows={1}
            />
            <button
              type="submit"
              disabled={!owner || !activeAgent || !textTurns.model || !chatInput.trim() || sending || textTurns.waiting || textTurns.historyError}
              className="control-focus min-h-11 rounded-xl bg-brand px-4 text-label font-semibold text-ink-on-accent hover:bg-brand-hover disabled:opacity-40"
            >
              {copy.buttons.send}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: List ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full min-w-0 flex flex-col bg-transparent text-ink">
      {/* Header */}
      <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/80 px-4 py-2 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-brand">
            {copy.headings.agents}
          </h2>
          <div className="flex gap-1 bg-well p-1 rounded-full border border-line-subtle" data-pill-segmented>
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                data-pill-segment-item
                aria-pressed={activeMainTab === tab}
                onClick={() => selectTab(tab)}
                className={`control-focus min-h-11 rounded-full px-3 text-label font-semibold transition-[background-color,color,box-shadow] duration-fast ease-standard ${
                  activeMainTab === tab
                    ? "bg-surface-raised text-ink shadow-elevation-1"
                    : "text-ink-muted hover:text-ink hover:bg-wash"
                }`}
              >
                {copy.tabs[tab] || tab.replace(/-/g, " ")}
              </button>
            ))}
          </div>


        </div>

        <button
          onClick={() => owner ? router.push("/agents/create") : onRequireAuth?.()}
          className="control-focus flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-label font-semibold text-ink-on-accent hover:bg-brand-hover"
        >
          <span className="text-sm">+</span>
          {copy.buttons.create}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/5 border-t-brand rounded-full animate-spin" />
          </div>
        ) : (!owner && (activeMainTab === "my-agents" || activeMainTab === "my-chats")) ? (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md rounded-2xl border border-line bg-overlay p-8 text-center flex flex-col items-center gap-4 shadow-elevation-4">
              <div className="w-12 h-12 rounded-xl bg-brand-soft border border-brand-line flex items-center justify-center text-brand">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-ink">{copy.auth?.heading || "登录以使用智能体"}</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                {copy.auth?.description || "模板、智能体配置与对话历史已同步至您的 SupDance 账号。请先登录。"}
              </p>
              <button
                type="button"
                onClick={() => onRequireAuth?.()}
                className="mt-2 px-6 py-2.5 bg-brand hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant text-ink-on-accent text-xs font-semibold uppercase tracking-wider rounded-xl transition-[background-color,transform] duration-fast ease-standard shadow-elevation-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                {copy.auth?.cta || "立即登录"}
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 gap-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs font-bold uppercase tracking-widest text-[#a0a4ab]">{error}</p>
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="text-[10px] text-ink-muted hover:text-ink border border-line hover:border-brand-line px-4 py-2 rounded-lg transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              {copy.buttons.retry}
            </button>
          </div>
        ) : activeMainTab === "my-chats" ? (
          // ── My Chats view ─────────────────────────────────────────────────
          items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/10 gap-4">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">{copy.empty.noChats}</p>
              <button
                onClick={() => selectTab("templates")}
                className="text-[10px] text-brand hover:text-ink border border-brand-line hover:border-line px-4 py-2 rounded-lg transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                {copy.buttons.browseTemplates}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-[1600px] mx-auto">
              {items.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  conv={conv}
                  onClick={openConversation}
                  copy={copy}
                />
              ))}
            </div>
          )
        ) : (
          // ── Agents grid (templates / my-agents) ───────────────────────────
          items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/10 gap-4">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">{copy.empty.noAgents}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 max-w-[1600px] mx-auto">
              {items.map((agent) => (
                <AgentCard
                  key={agent.agent_id || agent.id}
                  agent={agent}
                  onClick={openProfile}
                  onEdit={activeMainTab === "my-agents" ? editProfile : undefined}
                  copy={copy}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
