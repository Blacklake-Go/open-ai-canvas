"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getTemplateWorkflows,
  getUserWorkflows,
  getPublishedWorkflows,
  createWorkflow,
  updateWorkflowName,
  deleteWorkflow,
  getWorkflowInputs,
  executeWorkflow,
  getAllNodeSchemas,
  getWorkflowData,
} from "../muapi.js";
import dynamic from "next/dynamic";
import enCopy from "../messages/en/workflowStudio.json";
import zhCopy from "../messages/zh/workflowStudio.json";
import jaCopy from "../messages/ja-JP/workflowStudio.json";
import koCopy from "../messages/ko-KR/workflowStudio.json";
import zhTwCopy from "../messages/zh-TW/workflowStudio.json";
import esCopy from "../messages/es/workflowStudio.json";
import { resolveCopy } from "../i18nUtils";
import { PromptInputField } from "./prompt/PromptInputField.jsx";

const WORKFLOW_MESSAGES = {
  "zh-CN": zhCopy,
  "ja-JP": jaCopy,
  "ko-KR": koCopy,
  "zh-TW": zhTwCopy,
  es: esCopy,
  "es-ES": esCopy,
};

const WorkflowUI = dynamic(() => import("./WorkflowUI"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-white/5 border-t-brand rounded-full animate-spin" />
        <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">
          Loading Builder...
        </div>
      </div>
    </div>
  ),
});

function WorkflowCard({ workflow, onClick, activeTab, onRename, onDelete }) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div
      onClick={() => onClick(workflow)}
      className="group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border border-line-subtle bg-surface transition-[border-color,transform,box-shadow] hover:border-brand/30 hover:scale-[1.02] shadow-elevation-1"
    >
      {workflow.thumbnail ? (
        <img
          src={workflow.thumbnail}
          alt={workflow.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-20"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      
      {/* Options Dropdown for My Workflows */}
      {activeTab === 'my-workflows' && (
        <div 
          className="absolute top-2 right-2 z-dropdown"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <button
            onClick={() => setShowOptions(!showOptions)}
            onBlur={() => setTimeout(() => setShowOptions(false), 200)}
            className="w-8 h-8 rounded-full bg-overlay-glass backdrop-blur-md border border-line-subtle flex items-center justify-center text-ink-muted hover:text-ink hover:bg-well active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring shadow-elevation-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          
          {showOptions && (
            <div className="absolute top-10 right-0 z-dropdown w-32 rounded-lg border border-line bg-overlay-glass py-1 shadow-elevation-3 animate-fade-in">
              <button
                onClick={() => onRename(workflow)}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-ink-muted hover:text-brand hover:bg-wash active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Rename
              </button>
              <button
                onClick={() => onDelete(workflow.id)}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-danger hover:bg-danger-subtle/20 active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger-ring"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Community Profile Info */}
      {activeTab === 'published' && workflow.user_name && (
        <div className="absolute top-2 left-2 z-raised flex items-center gap-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
          <img src={workflow.user_profile || "/user_profile.png"} alt="profile" className="w-4 h-4 rounded-full" />
          <span className="text-[9px] font-black text-white/80 uppercase tracking-widest">{workflow.user_name}</span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1 opacity-80">
          {workflow.category || "General"}
        </div>
        <h3 className="text-sm font-bold text-white truncate group-hover:text-brand transition-colors">
          {workflow.name || "Untitled Flow"}
        </h3>
      </div>
    </div>
  );
}

export default function WorkflowStudio({
  apiKey,
  locale = "en",
  isHeaderVisible = true,
  onToggleHeader,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
}) {
  const workflowFeatureAvailable = false;
  const copy = resolveCopy(enCopy, WORKFLOW_MESSAGES, locale);
  const params = useParams();
  const router = useRouter();
  const idFromParams = params?.id;     // exists on /workflow/[id]/[tab] route
  const tabFromParams = params?.tab;   // string on /workflow/[id]/[tab]; array on the [[...tab]] catch-all
  // Catch-all routes (/studio/[brandSlug]/[[...tab]], /supdance/[[...tab]]) expose the
  // whole remaining path as params.tab (an array) — NOT params.slug, which doesn't exist on either
  // route and previously made this whole fallback branch permanently dead.
  const catchAllSegments = Array.isArray(tabFromParams) ? tabFromParams : [];

  // Robustly extract ID and Tab from either route structure
  const getWorkflowInfo = useCallback(() => {
    // Priority 1: Dedicated /workflow/[id]/[tab] route
    if (idFromParams) {
      return { id: idFromParams, tab: tabFromParams || null };
    }
    // Priority 2: Catch-all studio shell route — also recognizes the singular
    // "workflow" segment used by the standalone /workflow/[id]/[tab] URL scheme,
    // since a white-label custom domain's middleware rewrite lands here too.
    const wfIndex = catchAllSegments.findIndex(s => s === 'workflows' || s === 'workflow');
    if (wfIndex === -1) return { id: null, tab: null };
    return {
      id: catchAllSegments[wfIndex + 1] || null,
      tab: catchAllSegments[wfIndex + 2] || null
    };
  }, [catchAllSegments, idFromParams, tabFromParams]);

  const { id: urlWorkflowId, tab: urlTab } = getWorkflowInfo();

  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState("playground"); // 'playground' | 'builder'
  const [activeMainTab, setActiveMainTab] = useState("templates"); // 'templates' | 'my-workflows' | 'published'
  const [renamingWorkflow, setRenamingWorkflow] = useState(null);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [inputSchema, setInputSchema] = useState(null);
  const [nodeSchemas, setNodeSchemas] = useState(null);
  const [workflowDef, setWorkflowDef] = useState(null);
  const [formData, setFormData] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  

  // Handlers defined early so they can be used in effects
  const handleSelectWorkflow = useCallback(
    async (wf, fromUrl = false) => {
      setSelectedWorkflow(wf);
      setResult(null);
      setError(null);
      
      const targetTab = urlTab || "playground";
      setActiveSubTab(targetTab);

      if (!fromUrl) {
        // Always route to /workflow/[id] so the builder library's useParams().id resolves correctly
        router.push(`/workflow/${wf.id}/${targetTab}`);
      }
    },
    [router, urlTab],
  );

  // Dedicated data fetching effect for the active workflow
  useEffect(() => {
    if (!workflowFeatureAvailable) return;
    if (!selectedWorkflow?.id || !apiKey) return;

    async function loadWorkflowDetails() {
      try {
        setLoading(true);
        const wfId = selectedWorkflow.id;
        
        // Fetch everything in parallel with allSettled so one failure doesn't block the others
        const results = await Promise.allSettled([
          getWorkflowInputs(apiKey, wfId),
          getAllNodeSchemas(apiKey, wfId),
          getWorkflowData(apiKey, wfId)
        ]);

        // Process Input Schema
        if (results[0].status === 'fulfilled') {
          const response = results[0].value;
          const schema = response.input_data || response;
          setInputSchema(schema);

          const initial = {};
          Object.entries(schema.properties || {}).forEach(([key, prop]) => {
            initial[key] =
              prop.default ||
              (Array.isArray(prop.examples) ? prop.examples[0] : prop.examples) ||
              "";
          });
          setFormData(initial);
        } else {
          console.warn("Input schema not available for this workflow:", results[0].reason);
          setInputSchema(null);
          setFormData({});
        }

        // Process Builder State
        const nodes = results[1].status === 'fulfilled' ? results[1].value : [];
        const def = results[2].status === 'fulfilled' ? results[2].value : { nodes: [], edges: [] };

        setNodeSchemas(nodes);
        setWorkflowDef(def);

        if (results[1].status === 'rejected' || results[2].status === 'rejected') {
          console.error("Builder components failed to load:", results[1].reason, results[2].reason);
          if (!nodes.length && !def.nodes?.length) {
             setError("Failed to load full builder data. Some features may be disabled.");
          }
        }
      } catch (err) {
        console.error("Critical error loading pulse details:", err);
        setError("Critical error loading builder: " + err.message);
        setNodeSchemas([]);
        setWorkflowDef({ nodes: [], edges: [] });
      } finally {
        setLoading(false);
      }
    }

    loadWorkflowDetails();
  }, [selectedWorkflow?.id, apiKey]);

  const handleCreateWorkflow = useCallback(
    async (fromUrl = false) => {
      try {
        setLoading(true);
        if (!fromUrl) {
          const payload = {
            workflow_id: null,
            name: "Untitled Workflow",
            edges: [],
            data: { nodes: [] },
          };
          const response = await createWorkflow(apiKey, payload);
          // Route to /workflow/[id] so useParams().id works in the builder library.
          // That page has no white-label session of its own, so hand off our token
          // via sessionStorage — it reads "wl_workflow_token" on mount.
          if (apiKey) sessionStorage.setItem("wl_workflow_token", apiKey);
          router.push(`/workflow/${response.workflow_id}/builder`);
          return;
        }

        // Initialize state for the new flow
        setSelectedWorkflow({ id: null, name: "Untitled Workflow" });
        setNodeSchemas([]);
        setWorkflowDef({ nodes: [], edges: [] });
        setActiveSubTab("builder");
      } catch (err) {
        setError("Failed to initialize workflow: " + err.message);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, router],
  );

  const handleDeleteWorkflow = async (wfId) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;
    setIsDeletingId(wfId);
    try {
      await deleteWorkflow(apiKey, wfId);
      setWorkflows((prev) => prev.filter((w) => w.id !== wfId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete workflow");
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleRenameWorkflow = async (e) => {
    e?.preventDefault();
    if (!renamingWorkflow || !newWorkflowName.trim()) return;

    const wfId = renamingWorkflow.id;
    try {
      await updateWorkflowName(apiKey, wfId, newWorkflowName);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === wfId ? { ...w, name: newWorkflowName } : w)),
      );
      if (selectedWorkflow?.id === wfId) {
        setSelectedWorkflow({ ...selectedWorkflow, name: newWorkflowName });
      }
      setRenamingWorkflow(null);
    } catch (err) {
      console.error("Rename failed:", err);
      alert("Failed to rename workflow");
    }
  };

  // KEY FIX: If the user is on /studio/workflows/[id], redirect to /workflow/[id]
  // so the builder library's useParams().id resolves correctly, preventing duplicate creation.
  useEffect(() => {
    if (!workflowFeatureAvailable) return;
    if (typeof window !== 'undefined' && urlWorkflowId && urlWorkflowId !== 'new') {
      const path = window.location.pathname;
      if (path.startsWith('/studio/workflows/')) {
        const tab = urlTab || 'builder';
        router.replace(`/workflow/${urlWorkflowId}/${tab}`);
      }
    }
  }, [urlWorkflowId, urlTab, router]);

  // 1. Sync state with URL on mount or URL change
  useEffect(() => {
    if (!workflowFeatureAvailable) return;
    if (loading) return;

    if (urlWorkflowId) {
      if (urlWorkflowId === "new") {
        if (!selectedWorkflow || selectedWorkflow.id !== null) {
          handleCreateWorkflow(true);
        }
      } else {
        const found = workflows.find((wf) => wf.id === urlWorkflowId);
        if (found) {
          if (!selectedWorkflow || selectedWorkflow.id !== urlWorkflowId) {
            handleSelectWorkflow(found, true);
          }
        } else if (
          !selectedWorkflow ||
          selectedWorkflow.id !== urlWorkflowId
        ) {
          // Fallback for deep-linking: attempt to open even if not in the current tab's list
          // handleSelectWorkflow fetches official name/data anyway
          handleSelectWorkflow(
            { id: urlWorkflowId, name: "Loading..." },
            true,
          );
        }
      }
    } else if (selectedWorkflow) {
      setSelectedWorkflow(null);
    }
  }, [
    urlWorkflowId,
    workflows,
    loading,
    selectedWorkflow,
    handleCreateWorkflow,
    handleSelectWorkflow,
  ]);

  useEffect(() => {
    if (!workflowFeatureAvailable) return;
    async function loadWorkflows() {
      try {
        setLoading(true);
        let data = [];
        if (activeMainTab === "templates") {
          data = await getTemplateWorkflows(apiKey);
        } else if (activeMainTab === "my-workflows") {
          data = await getUserWorkflows(apiKey);
        } else if (activeMainTab === "published") {
          data = await getPublishedWorkflows(apiKey);
        }
        setWorkflows(data);
      } catch (err) {
        console.error("Failed to load workflows:", err);
        setError("Failed to load workflows list.");
      } finally {
        setLoading(false);
      }
    }
    loadWorkflows();
  }, [apiKey, activeMainTab]);

  useEffect(() => {
    if (!renamingWorkflow) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setRenamingWorkflow(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [renamingWorkflow]);

  const handleRun = async (e) => {
    e.preventDefault();
    if (isExecuting) return;

    onGenerationStart?.();
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const inputs = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (!value) return;
        if (key.startsWith("text")) inputs[key] = { prompt: value };
        else if (key.startsWith("image")) inputs[key] = { image_url: value };
        else if (key.startsWith("video")) inputs[key] = { video_url: value };
        else inputs[key] = value;
      });

      const data = await executeWorkflow(apiKey, selectedWorkflow.id, inputs);
      setResult(data);
      onGenerationComplete?.({
        url: data?.url || data?.output?.url || data?.outputs?.[0]?.url || null,
        type: "workflow",
      });
    } catch (err) {
      console.error("Execution failed:", err);
      const message = err.message || "Execution failed";
      setError(message);
      onGenerationError?.(message);
    } finally {
      setIsExecuting(false);
      onGenerationEnd?.();
    }
  };

  // Workflow execution and private workflow ownership are not yet backed by
  // user-scoped SupDance APIs. Keep the imported gallery/editor closed until
  // those paths have billing, authorization, and terminal-result verification.
  if (!workflowFeatureAvailable) {
    return (
      <section
        className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center"
        role="status"
        data-feature-status="unavailable"
      >
        <h2 className="text-lg font-semibold text-ink">{copy.unavailable.title}</h2>
        <p className="max-w-lg text-sm text-ink-muted">
          {copy.unavailable.description}
        </p>
      </section>
    );
  }

  if (loading && !selectedWorkflow) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin text-brand text-3xl">◌</div>
      </div>
    );
  }

  if (selectedWorkflow) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white">
        {/* Immersive Sub-header / Floating Toggle */}
        {isHeaderVisible ? (
          <div className="flex-shrink-0 h-14 border-b border-line-subtle flex items-center justify-between px-6 bg-overlay-glass backdrop-blur-xl z-header">
            <div className="flex items-center gap-8 h-full">
              <button
                onClick={() => router.push("/studio/workflows")}
                className="flex items-center gap-2 text-xs font-bold text-ink-muted hover:text-ink active:scale-[0.98] active:duration-instant transition-[color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                All Workflows
              </button>

              <div className="h-4 w-[1px] bg-line" />

              <div className="flex h-full">
                <div className="flex bg-wash p-1 rounded-full my-auto">
                  <button
                    onClick={() => {
                        setActiveSubTab("playground");
                        if (selectedWorkflow?.id) router.push(`/workflow/${selectedWorkflow.id}/playground`);
                    }}
                    type="button"
                    className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-[background-color,color,box-shadow,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                      activeSubTab === "playground"
                        ? "bg-surface-inverse text-ink-inverse shadow-elevation-1"
                        : "text-ink-muted hover:text-ink hover:bg-wash"
                    }`}
                  >
                    Playground
                  </button>
                  <button
                    onClick={() => {
                        setActiveSubTab("builder");
                        if (selectedWorkflow?.id) {
                          if (apiKey) sessionStorage.setItem("wl_workflow_token", apiKey);
                          router.push(`/workflow/${selectedWorkflow.id}/builder`);
                        }
                    }}
                    type="button"
                    className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-[background-color,color,box-shadow,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                      activeSubTab === "builder"
                        ? "bg-surface-inverse text-ink-inverse shadow-elevation-1"
                        : "text-ink-muted hover:text-ink hover:bg-wash"
                    }`}
                  >
                    Full Workflow
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black text-brand uppercase tracking-widest">
                {selectedWorkflow.name}
              </span>
              <button
                onClick={() => onToggleHeader?.(false)}
                className="p-1.5 bg-wash hover:bg-well active:scale-95 active:duration-instant rounded-md transition-[background-color,color,transform] duration-fast ease-standard text-ink-muted hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                title="Enter Zen Mode"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* Floating Immersive Mode Controller */
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-sticky flex items-center gap-4 px-4 py-2 bg-overlay-glass backdrop-blur-xl border border-line-subtle rounded-full shadow-elevation-2 animate-fade-in">
            <button
               onClick={() => router.push("/studio/workflows")}
               className="p-1.5 text-ink-muted hover:text-ink active:scale-95 active:duration-instant transition-[color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
               title="Back to All Workflows"
               type="button"
            >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            
            <div className="h-4 w-[1px] bg-line" />
            
            <div className="flex bg-wash p-1 rounded-full">
               <button
                 onClick={() => setActiveSubTab("playground")}
                 type="button"
                 className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full transition-[background-color,color,box-shadow,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                   activeSubTab === "playground" ? "bg-surface-inverse text-ink-inverse shadow-elevation-1" : "text-ink-muted hover:text-ink hover:bg-wash"
                 }`}
               >
                 Play
               </button>
               <button
                 onClick={() => setActiveSubTab("builder")}
                 type="button"
                 className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full transition-[background-color,color,box-shadow,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                   activeSubTab === "builder" ? "bg-surface-inverse text-ink-inverse shadow-elevation-1" : "text-ink-muted hover:text-ink hover:bg-wash"
                 }`}
               >
                 Builder
               </button>
            </div>

            <div className="h-4 w-[1px] bg-line" />

            <button
              onClick={() => onToggleHeader?.(true)}
              className="px-3 py-1 bg-wash hover:bg-well active:scale-[0.98] active:duration-instant text-[9px] font-black text-ink uppercase tracking-widest rounded-lg transition-[background-color,color,transform] duration-fast ease-standard flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              type="button"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 14h6v6M20 10h-6V4M10 20l-7-7M14 4l7 7"/></svg>
              Exit Zen
            </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {activeSubTab === "playground" ? (
            <>
              {/* Controls Panel */}
              <div className="w-full lg:w-[400px] border-r border-white/5 flex flex-col bg-black/20">
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                  <form onSubmit={handleRun} className="space-y-6">
                    <div>
                      <h3 className="text-xs font-black text-white/30 uppercase tracking-widest mb-4">
                        Configuration
                      </h3>
                      <div className="space-y-4">
                        {inputSchema &&
                          Object.entries(inputSchema.properties || {}).map(
                            ([key, prop]) => (
                              <div key={key} className="space-y-2">
                                <label className="block text-[11px] font-bold text-white/80 uppercase tracking-wider">
                                  {prop.title || key}
                                </label>
                                {prop.type === "string" && !prop.enum ? (
                                  <PromptInputField
                                    value={formData[key] || ""}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        [key]: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      prop.description || `Enter ${key}...`
                                    }
                                    rows={2}
                                  />
                                ) : prop.enum ? (
                                  <select
                                    value={formData[key] || ""}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        [key]: e.target.value,
                                      })
                                    }
                                    className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring transition-[background-color,border-color,box-shadow]"
                                  >
                                    {prop.enum.map((opt) => (
                                      <option
                                        key={opt}
                                        value={opt}
                                        className="bg-black"
                                      >
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={formData[key] || ""}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        [key]: e.target.value,
                                      })
                                    }
                                    className="w-full bg-well border border-line rounded-xl p-3 text-sm text-ink focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring transition-[background-color,border-color,box-shadow]"
                                    placeholder={
                                      prop.description || `Enter ${key}...`
                                    }
                                  />
                                )}
                              </div>
                            ),
                          )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isExecuting || !selectedWorkflow.id}
                      className="w-full py-4 bg-brand text-ink-on-accent text-xs font-black uppercase tracking-[0.2em] rounded-lg hover:bg-brand-hover transition-[background-color,color,border-color,transform,box-shadow] duration-fast ease-standard active:scale-[0.98] active:duration-instant disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none shadow-elevation-1 flex items-center justify-center gap-3 mt-8 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand cursor-pointer"
                    >
                      {isExecuting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path d="M5 3l14 9-14 9V3z" />
                          </svg>
                          <span>Run Workflow</span>
                        </>
                      )}
                    </button>
                    {!selectedWorkflow.id && (
                      <p className="text-[10px] text-white/30 text-center mt-4">
                        Save your workflow first to enable execution.
                      </p>
                    )}
                  </form>
                </div>
              </div>

              {/* Preview Panel */}
              <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-[#050505] flex items-center justify-center min-h-[500px]">
                {error && (
                  <div className="w-full max-w-md p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center gap-4 animate-shake">
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block mb-1">
                        Execution Error
                      </span>
                      <p className="text-white/60 text-sm leading-relaxed">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {!isExecuting && !result && !error && (
                  <div className="flex flex-col items-center gap-6 opacity-40">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-white/20">
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <p className="text-xs text-white/40 max-w-[200px] mx-auto text-center font-medium">
                      Configure parameters and run the workflow to see results.
                    </p>
                  </div>
                )}

                {isExecuting && (
                  <div className="flex flex-col items-center gap-6 animate-fade-in">
                    <div className="relative">
                      <div className="w-24 h-24 border-[3px] border-white/5 border-t-brand rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center text-brand">
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="animate-pulse"
                        >
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-[10px] font-black text-brand uppercase tracking-[0.3em] animate-pulse">
                        Running Pipeline
                      </div>
                      <div className="text-[13px] text-white/40 font-medium">
                        Processing nodes and generating assets...
                      </div>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="w-full max-w-4xl space-y-8 animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black text-white/30 uppercase tracking-widest">
                        Workflow Results
                      </h3>
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-bold border border-green-500/20">
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />{" "}
                        COMPLETED
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {result.outputs?.map((out, idx) => (
                        <div
                          key={idx}
                          className="group relative bg-surface border border-line-subtle rounded-xl overflow-hidden hover:border-brand/30 transition-[border-color,box-shadow] shadow-elevation-2"
                        >
                          {out.type === "image_url" ? (
                            <img
                              src={out.value}
                              className="w-full aspect-square object-cover"
                              alt="Output"
                            />
                          ) : out.type === "video_url" ? (
                            <video
                              src={out.value}
                              controls
                              className="w-full aspect-square object-cover"
                            />
                          ) : (
                            <div className="p-6 min-h-[200px] flex items-center justify-center italic text-white/60">
                              {out.value}
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-brand uppercase tracking-widest">
                                {out.id}
                              </span>
                              <a
                                href={out.value}
                                target="_blank"
                                rel="noreferrer"
                                className="w-8 h-8 rounded-lg bg-raised flex items-center justify-center hover:bg-brand hover:text-ink-on-accent transition-colors"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 relative bg-[#050505]">
              {nodeSchemas && workflowDef ? (
                <WorkflowUI
                  apiKey={apiKey}
                  workflowId={selectedWorkflow?.id}
                  initialNodeSchemas={nodeSchemas}
                  initialWorkflowData={{
                    ...workflowDef,
                    // Inject ID to prevent builder from assuming this is a new unsaved flow
                    workflow_id: selectedWorkflow?.id
                  }}
                  onGenerationStart={onGenerationStart}
                  onGenerationEnd={onGenerationEnd}
                  onGenerationComplete={onGenerationComplete}
                  onGenerationError={onGenerationError}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-white/5 border-t-brand rounded-full animate-spin" />
                    <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                      Loading Builder...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render main workflow list
  return (
    <div className="h-full w-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-6 mb-12">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                Workflows
              </h1>
              <p className="text-white/40 text-sm font-medium">
                Create and manage your asynchronous AI processing pipelines
              </p>
            </div>
            <button
              onClick={() => handleCreateWorkflow()}
              className="px-6 py-3 bg-brand text-ink-on-accent text-xs font-black uppercase tracking-widest rounded-lg hover:bg-brand-hover transition-[background-color,color,border-color,transform,box-shadow] duration-fast ease-standard active:scale-[0.98] active:duration-instant shadow-elevation-1 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Workflow
            </button>
          </div>

          <div className="flex items-center gap-2 border-b border-white/5">
            <button
              onClick={() => setActiveMainTab("templates")}
              className={`px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition-[color,border-color,transform] duration-fast ease-standard border-b-2 active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                activeMainTab === "templates"
                  ? "text-brand border-brand"
                  : "text-ink-subtle border-transparent hover:text-ink"
              }`}
            >
              Templates
            </button>
            <button
              onClick={() => setActiveMainTab("my-workflows")}
              className={`px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition-[color,border-color,transform] duration-fast ease-standard border-b-2 active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                activeMainTab === "my-workflows"
                  ? "text-brand border-brand"
                  : "text-ink-subtle border-transparent hover:text-ink"
              }`}
            >
              My Workflows
            </button>
            <button
              onClick={() => setActiveMainTab("published")}
              className={`px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition-[color,border-color,transform] duration-fast ease-standard border-b-2 active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                activeMainTab === "published"
                  ? "text-brand border-brand"
                  : "text-ink-subtle border-transparent hover:text-ink"
              }`}
            >
              Community
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/5 border-t-brand rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onClick={handleSelectWorkflow}
                activeTab={activeMainTab}
                onRename={(wf) => {
                   setRenamingWorkflow(wf);
                   setNewWorkflowName(wf.name);
                }}
                onDelete={handleDeleteWorkflow}
              />
            ))}
            {!loading && workflows.length === 0 && (
              <div className="col-span-full py-24 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                <div className="text-white/20 text-sm font-medium italic">
                  No workflows found in this section.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {renamingWorkflow && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter" onClick={() => setRenamingWorkflow(null)} />
          <form 
            onSubmit={handleRenameWorkflow}
            className="relative w-full max-w-sm bg-overlay border border-line rounded-2xl p-8 shadow-elevation-4 animate-in zoom-in-95 duration-modal ease-enter"
          >
            <h3 className="text-xl font-bold text-ink mb-2">Rename Workflow</h3>
            <p className="text-ink-muted text-sm mb-6">Enter a new descriptive name for your pipeline.</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand uppercase tracking-widest">Workflow Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  placeholder="e.g. Cinematic Video Flow"
                  className="w-full bg-well border border-line rounded-xl px-4 py-3 text-sm text-ink focus-visible:outline-none focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand-ring transition-[background-color,border-color,box-shadow]"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setRenamingWorkflow(null)}
                  className="flex-1 px-4 py-3 rounded-lg text-xs font-black text-ink-muted hover:text-ink hover:bg-wash active:scale-[0.98] active:duration-instant uppercase tracking-widest transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand text-ink-on-accent px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-brand-hover active:scale-[0.98] active:duration-instant transition-[background-color,color,border-color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:border-brand"
                >
                  Save Name
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
