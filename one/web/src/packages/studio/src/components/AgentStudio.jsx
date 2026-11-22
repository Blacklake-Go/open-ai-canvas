"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getTemplateAgents,
  getUserAgents,
  getUserConversations,
  getAgentBySlug,
  getAgentConversation,
  sendAgentChatMessage,
  pollAgentChatResult,
  createAgent,
} from "../muapi.js";
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
      <div
        onClick={() => onClick(agent)}
        className="absolute inset-0 rounded-xl overflow-hidden border border-line bg-surface transition-[border-color,transform] duration-fast ease-standard group-hover:border-brand-line group-hover:scale-[1.02] shadow-elevation-2"
      >
        {agent.icon_url ? (
          <img
            src={agent.icon_url}
            alt={agent.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="opacity-20">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1 opacity-80">
            {agent.category || copy.card.defaultCategory}
          </div>
          <h3 className="text-sm font-bold text-white truncate group-hover:text-brand transition-colors">
            {agent.name || copy.card.unnamedAgent}
          </h3>
          {agent.owner_username && (
            <p className="text-[9px] text-white/40 mt-1 uppercase tracking-tighter font-black">
              {copy.card.byPrefix} {agent.owner_username}
            </p>
          )}
        </div>
      </div>
      
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(agent);
          }}
          className="pointer-events-none absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 max-sm:pointer-events-auto max-sm:opacity-100 hover:bg-brand hover:text-ink-on-accent active:bg-brand-active active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
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
    <div
      onClick={() => onClick(agentSlug, conv.id)}
      className="group flex flex-col gap-3 bg-surface border border-line rounded-xl p-4 hover:border-brand-line hover:bg-wash transition-[border-color,background-color] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
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
          <p className="text-sm font-bold text-white truncate" title={displayTitle}>
            {displayTitle}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto text-[10px] text-white/30 font-medium">
        <span>{timeAgo(conv.updated_at, copy)}</span>
        {conv.message_count != null && <span>{conv.message_count} {copy.card.msgsSuffix}</span>}
      </div>
    </div>
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-pre:bg-black/40">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || "…"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

const FALLBACK_TEMPLATES = [
  {
    id: "d5d5f2c4-35f6-4d5c-8bec-33aae1cbba9b",
    name: "CaptionCrafter Pro",
    agent_id: "captioncrafterpro",
    description: "友好且专业的文案生成专家，为各种图像、主题和社交平台量身定制吸睛文案。",
    icon_url: "https://d3adwkbyhxyrtq.cloudfront.net/data/186/466840908889/0cb0f860-0c88-4bde-80c5-14e5c8580bbb.jpg",
    category: "AI 助手",
    welcome_message: "你好！准备好将你的创意转化为引人注目的文案了吗？",
    theme: "cosmic",
    owner_username: "SupDance",
  },
  {
    id: "2ef7de87-d151-4622-b7e6-3c4fed3b274a",
    name: "Suno Prompter Pro",
    agent_id: "sunoprompterpro",
    description: "Suno 音乐创作提示词架构师，帮助提炼歌词、雕琢编曲与声音情绪风格。",
    icon_url: "https://d3adwkbyhxyrtq.cloudfront.net/data/186/486500878153/9e9a908e-bdf1-406e-80a4-d5651bc6055a.jpg",
    category: "AI 音乐",
    welcome_message: "嘿！准备好打磨你的下一首 Suno 歌曲了吗？告诉我你想要的氛围与风格。",
    theme: "light",
    owner_username: "SupDance",
  },
  {
    id: "edfa0142-e03c-4006-8c7c-a1de05264a90",
    name: "FutureScope",
    agent_id: "futurescope",
    description: "趣味预测助手，根据名字或主题构想生动有趣、脑洞大开的未来场景。",
    icon_url: "https://d3adwkbyhxyrtq.cloudfront.net/data/186/433722331049/55b8271c-5842-44bc-9ac1-6e6362eddcb6.jpg",
    category: "趣味互动",
    welcome_message: "输入你的名字或角色，我来为你揭晓一个意想不到的未来片段。",
    theme: "cosmic",
    owner_username: "SupDance",
  },
  {
    id: "08452be2-296a-4a41-8bf4-cb569343dad3",
    name: "Email Copywriter Pro",
    agent_id: "emailcopywriterpro",
    description: "高效营销与商务邮件专家，专精高打开率的主题行与行动号召撰写。",
    icon_url: "https://d3adwkbyhxyrtq.cloudfront.net/data/186/466840908889/0cb0f860-0c88-4bde-80c5-14e5c8580bbb.jpg",
    category: "营销创作",
    welcome_message: "准备好撰写引人入胜、促成转化的优质邮件了。今天想构思什么主题？",
    theme: "light",
    owner_username: "SupDance",
  },
  {
    id: "394fd4dd-de6f-40a0-828e-e10c63b05840",
    name: "Visual Storyteller",
    agent_id: "visualstoryteller",
    description: "分镜脚本与视觉叙事大师，将剧本与灵感快速转化为生动的多镜头故事。",
    icon_url: "https://d3adwkbyhxyrtq.cloudfront.net/data/186/486500878153/9e9a908e-bdf1-406e-80a4-d5651bc6055a.jpg",
    category: "视觉叙事",
    welcome_message: "告诉我你的故事大纲或核心角色，我们一起来拆解镜头与视觉设定。",
    theme: "cosmic",
    owner_username: "SupDance",
  },
  {
    id: "27bc8fb6-78c5-4545-988a-e7779e3a1492",
    name: "Prompt Architect",
    agent_id: "promptarchitect",
    description: "高级多模态提示词优化师，精细调节光影、材质、构图与镜头参数。",
    icon_url: "https://d3adwkbyhxyrtq.cloudfront.net/data/186/433722331049/55b8271c-5842-44bc-9ac1-6e6362eddcb6.jpg",
    category: "提示词工程",
    welcome_message: "把你的初步灵感发给我，我来帮你转换为专业级图像与视频提示词。",
    theme: "light",
    owner_username: "SupDance",
  }
];

// ─── Main Component ──────────────────────────────────────────────────────────
const TABS = ["templates", "my-agents", "my-chats"];

export default function AgentStudio({
  apiKey,
  locale = "en",
  signedIn = false,
  onRequireAuth,
  initialModel = "",
  isHeaderVisible = true,
  onToggleHeader,
}) {
  const router = useRouter();
  const params = useParams();
  const copy = resolveCopy(en, AGENT_MESSAGES, locale);

  const effectiveApiKey = apiKey || (signedIn ? 'supdance-account-session' : null);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (initialModel) return initialModel;
    if (typeof window !== "undefined") {
      const urlModel = new URLSearchParams(window.location.search).get("model");
      if (urlModel) return urlModel;
    }
    return "";
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const urlModel = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("model") : null;
    const targetModel = initialModel || urlModel;
    if (targetModel) setSelectedModel(targetModel);
  }, [initialModel]);

  useEffect(() => {
    const handleModelSelect = (e) => {
      const model = e?.detail?.modelKey || e?.detail?.modelId;
      const tabId = e?.detail?.tabId;
      if (tabId && tabId !== "agents") return;
      if (model) {
        setSelectedModel(model);
      }
    };
    window.addEventListener("supdance-select-model", handleModelSelect);
    return () => window.removeEventListener("supdance-select-model", handleModelSelect);
  }, []);

  const [activeMainTab, setActiveMainTab] = useState("templates");
  const [agents, setAgents] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Deep-link routing. `router.push('/agents/...')` below is a real full navigation
  // away from the studio shell on muapi.ai (BYOK/dashboard) — AiAgent's own standalone
  // pages handle it there, unaffected. On a white-label custom domain the same push is
  // transparently rewritten by middleware.js back to this same catch-all shell route, so
  // reading it back out via useParams() here drives an inline view instead of navigating
  // anywhere — see docs/whitelabel_plan.md for the full routing writeup.
  const tabSegments = Array.isArray(params?.tab) ? params.tab : [];
  const agentsIdx = tabSegments.indexOf("agents");
  const urlAgentSlug = agentsIdx === -1 ? null : tabSegments[agentsIdx + 1] || null;
  const urlConversationId = agentsIdx === -1 ? null : tabSegments[agentsIdx + 2] || null;

  const [view, setView] = useState("list"); // 'list' | 'chat' | 'create'
  const [activeAgent, setActiveAgent] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState(null);

  const [createForm, setCreateForm] = useState({ name: "", description: "", system_prompt: "", welcome_message: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Navigate to the standalone /agents page — AiAgent handles its own routing there
  // (on a custom domain, this instead drives the inline view below via urlAgentSlug)
  const handleSelectAgent = useCallback(
    (agent) => {
      const id = agent.agent_id || agent.id;
      if (!effectiveApiKey && onRequireAuth) {
        onRequireAuth();
        return;
      }
      router.push(`/agents/${id}`);
    },
    [effectiveApiKey, onRequireAuth, router]
  );

  const handleEditAgent = useCallback(
    (agent) => {
      const id = agent.agent_id || agent.id;
      router.push(`/agents/edit/${id}`);
    },
    [router]
  );

  const handleCreateAgent = useCallback(() => {
    if (!effectiveApiKey && onRequireAuth) {
      onRequireAuth();
      return;
    }
    router.push("/agents/create");
  }, [effectiveApiKey, onRequireAuth, router]);

  const handleOpenConversation = useCallback(
    (agentSlug, convId) => {
      router.push(`/agents/${agentSlug}/${convId}`);
    },
    [router]
  );

  // Resolve the inline view from the URL. 'edit' isn't built inline yet (only used
  // from the standalone dashboard today) — treat it as "back to list" rather than
  // trying to load an agent named "edit" and showing a confusing error.
  useEffect(() => {
    if (!effectiveApiKey) return;
    if (!urlAgentSlug || urlAgentSlug === "edit") {
      setView("list");
      return;
    }
    if (urlAgentSlug === "create") {
      setView("create");
      return;
    }

    let cancelled = false;
    async function openFromUrl() {
      setChatLoading(true);
      setChatError(null);
      try {
        const agent = await getAgentBySlug(effectiveApiKey, urlAgentSlug);
        if (cancelled) return;
        setActiveAgent(agent);
        if (urlConversationId) {
          const conv = await getAgentConversation(effectiveApiKey, urlAgentSlug, urlConversationId);
          if (cancelled) return;
          setConversationId(conv.id);
          setChatMessages(conv.history || []);
        } else {
          setConversationId(null);
          setChatMessages([]);
        }
        setView("chat");
      } catch (err) {
        if (!cancelled) setChatError(err.message || copy.errors.loadAgentFailed);
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    }
    openFromUrl();
    return () => { cancelled = true; };
  }, [effectiveApiKey, urlAgentSlug, urlConversationId]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || sending || !activeAgent) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    setChatError(null);
    try {
      const agentSlug = activeAgent.agent_id;
      const { request_id } = await sendAgentChatMessage(effectiveApiKey, agentSlug, {
        message: text,
        conversationId,
      });
      const result = await pollAgentChatResult(effectiveApiKey, request_id);
      // result.messages is only this turn's assistant/pulse entries, not the
      // full transcript (see AiAgent.jsx) — append, don't replace, or every
      // send wipes the user's own message and all prior history from view.
      const assistantMessage = (result.messages || []).find(
        (m) => m.role === "assistant" && m.content
      );
      setChatMessages((prev) => [
        ...prev,
        assistantMessage || { role: "assistant", content: "" },
      ]);
      if (result.conversation_id && result.conversation_id !== conversationId) {
        setConversationId(result.conversation_id);
        router.replace(`/agents/${agentSlug}/${result.conversation_id}`, { scroll: false });
      }
    } catch (err) {
      setChatError(err.message || copy.errors.sendFailed);
    } finally {
      setSending(false);
    }
  }, [effectiveApiKey, activeAgent, conversationId, chatInput, sending, router, copy.errors.sendFailed]);

  const handleCreateSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!createForm.name.trim() || !createForm.system_prompt.trim() || creating) return;
      setCreating(true);
      setCreateError(null);
      try {
        const created = await createAgent(effectiveApiKey, {
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
          system_prompt: createForm.system_prompt.trim(),
          welcome_message: createForm.welcome_message.trim() || null,
          skill_ids: [],
        });
        router.push(`/agents/${created.agent_id}`);
      } catch (err) {
        setCreateError(err.message || copy.errors.createFailed);
      } finally {
        setCreating(false);
      }
    },
    [effectiveApiKey, createForm, creating, router, copy.errors.createFailed]
  );

  useEffect(() => {
    let cancelled = false;

    if (view !== "list") return () => { cancelled = true; };

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (activeMainTab === "templates") {
          let data = [];
          try {
            data = await getTemplateAgents(effectiveApiKey);
          } catch (fetchErr) {
            console.warn("Upstream template fetch failed, using fallback templates:", fetchErr);
            data = FALLBACK_TEMPLATES;
          }
          if (!cancelled) {
            setAgents(Array.isArray(data) && data.length > 0 ? data : FALLBACK_TEMPLATES);
          }
        } else if (activeMainTab === "my-agents") {
          if (!effectiveApiKey) {
            if (!cancelled) {
              setAgents([]);
              setLoading(false);
            }
            return;
          }
          const data = await getUserAgents(effectiveApiKey);
          if (!cancelled) setAgents(Array.isArray(data) ? data : []);
        } else if (activeMainTab === "my-chats") {
          if (!effectiveApiKey) {
            if (!cancelled) {
              setConversations([]);
              setLoading(false);
            }
            return;
          }
          const data = await getUserConversations(effectiveApiKey);
          if (!cancelled) setConversations(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("AgentStudio load error:", err);
        if (!cancelled) setError(err.message || copy.errors.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [effectiveApiKey, activeMainTab, view, retryCount, copy.errors.loadFailed]);

  // ── Render: Create ───────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div className="h-full flex flex-col bg-canvas text-white overflow-y-auto custom-scrollbar">
        <div className="flex-shrink-0 h-16 border-b border-white/5 flex items-center gap-6 px-8 bg-black/40">
          <button
            onClick={() => router.push("/agents")}
            className="flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white active:scale-[0.98] active:duration-instant transition-[color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {copy.buttons.back}
          </button>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-brand">{copy.headings.createAgent}</h2>
        </div>

        <form onSubmit={handleCreateSubmit} className="max-w-2xl w-full mx-auto p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">{copy.labels.name}</label>
            <input
              type="text"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={copy.placeholders.name}
              className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand transition-[border-color,box-shadow] duration-fast ease-standard"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">{copy.labels.description}</label>
            <input
              type="text"
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={copy.placeholders.description}
              className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand transition-[border-color,box-shadow] duration-fast ease-standard"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">{copy.labels.systemPrompt}</label>
            <textarea
              required
              value={createForm.system_prompt}
              onChange={(e) => setCreateForm((f) => ({ ...f, system_prompt: e.target.value }))}
              placeholder={copy.placeholders.systemPrompt}
              className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand transition-[border-color,box-shadow] duration-fast ease-standard min-h-[140px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">{copy.labels.welcomeMessage}</label>
            <input
              type="text"
              value={createForm.welcome_message}
              onChange={(e) => setCreateForm((f) => ({ ...f, welcome_message: e.target.value }))}
              placeholder={copy.placeholders.welcomeMessage}
              className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand transition-[border-color,box-shadow] duration-fast ease-standard"
            />
          </div>

          {createError && (
            <p className="text-xs font-bold text-red-400">{createError}</p>
          )}

          <button
            type="submit"
            disabled={creating || !createForm.name.trim() || !createForm.system_prompt.trim()}
            className="w-full py-3.5 bg-brand text-ink-on-accent text-xs font-semibold uppercase tracking-[0.2em] rounded-xl hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant transition-[background-color,transform] duration-fast ease-standard disabled:pointer-events-none disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring flex items-center justify-center gap-3"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                <span>{copy.buttons.creating}</span>
              </>
            ) : (
              <span>{copy.buttons.createAgentSubmit}</span>
            )}
          </button>
        </form>
      </div>
    );
  }

  // ── Render: Chat ─────────────────────────────────────────────────────────────
  if (view === "chat") {
    return (
      <div className="h-full flex flex-col bg-canvas text-white">
        <div className="flex-shrink-0 h-16 border-b border-white/5 flex items-center gap-4 px-8 bg-black/40">
          <button
            onClick={() => router.push("/agents")}
            className="flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white active:scale-[0.98] active:duration-instant transition-[color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
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
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/5 shrink-0">
                {activeAgent.icon_url ? (
                  <img src={activeAgent.icon_url} alt={activeAgent.name} className="w-full h-full object-cover" />
                ) : null}
              </div>
              <span className="text-sm font-bold text-white">{activeAgent.name}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-4 max-w-3xl w-full mx-auto">
          {chatLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-white/5 border-t-brand rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {chatMessages.length === 0 && activeAgent?.welcome_message && (
                <ChatBubble message={{ role: "assistant", content: activeAgent.welcome_message }} />
              )}
              {chatMessages.map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-surface border border-line rounded-2xl px-4 py-3">
                    <div className="w-4 h-4 border-2 border-line-subtle border-t-brand rounded-full animate-spin" />
                  </div>
                </div>
              )}
              {chatError && (
                <p className="text-xs font-bold text-red-400">{chatError}</p>
              )}
            </>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-white/5 p-6 bg-black/40">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="max-w-3xl w-full mx-auto flex items-end gap-3"
          >
            <PromptInputField
              className="flex-1"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onEnter={handleSendMessage}
              placeholder={copy.placeholders.chatInput}
              rows={1}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || sending}
              className="px-5 py-3 bg-brand text-ink-on-accent text-xs font-semibold uppercase tracking-widest rounded-xl hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant transition-[background-color,transform] duration-fast ease-standard disabled:pointer-events-none disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring shadow-elevation-1"
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
    <div className="h-full flex flex-col bg-canvas text-white">
      {/* Header */}
      <div className="flex-shrink-0 h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/40">
        <div className="flex items-center gap-6 h-full">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-brand">
            {copy.headings.agents}
          </h2>
          <div className="flex gap-1 bg-well p-1 rounded-full border border-line-subtle" data-pill-segmented>
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                data-pill-segment-item
                onClick={() => setActiveMainTab(tab)}
                className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest rounded-full transition-[background-color,color,box-shadow,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                  activeMainTab === tab
                    ? "bg-surface-raised text-ink shadow-elevation-1"
                    : "text-ink-muted hover:text-ink hover:bg-wash"
                }`}
              >
                {copy.tabs[tab] || tab.replace(/-/g, " ")}
              </button>
            ))}
          </div>

          {selectedModel && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft border border-brand-line text-brand text-[11px] font-mono tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span>{selectedModel === 'deepseek-r1' ? 'DeepSeek-R1' : selectedModel === 'gpt-4o' ? 'GPT-4o' : selectedModel === 'claude-3-7-sonnet' ? 'Claude 3.7 Sonnet' : selectedModel}</span>
            </div>
          )}
        </div>

        <button
          onClick={handleCreateAgent}
          className="px-5 py-2 bg-brand text-ink-on-accent text-[11px] font-semibold uppercase tracking-widest rounded-xl hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant transition-[background-color,transform] duration-fast ease-standard flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
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
        ) : (!effectiveApiKey && (activeMainTab === "my-agents" || activeMainTab === "my-chats")) ? (
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
          conversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/10 gap-4">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">{copy.empty.noChats}</p>
              <button
                onClick={() => setActiveMainTab("templates")}
                className="text-[10px] text-brand hover:text-ink border border-brand-line hover:border-line px-4 py-2 rounded-lg transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                {copy.buttons.browseTemplates}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-[1600px] mx-auto">
              {conversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  conv={conv}
                  onClick={handleOpenConversation}
                  copy={copy}
                />
              ))}
            </div>
          )
        ) : (
          // ── Agents grid (templates / my-agents) ───────────────────────────
          agents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/10 gap-4">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">{copy.empty.noAgents}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 max-w-[1600px] mx-auto">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.agent_id || agent.id}
                  agent={agent}
                  onClick={handleSelectAgent}
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
