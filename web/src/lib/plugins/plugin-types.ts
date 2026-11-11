import type { Asset } from "@/stores/use-asset-store";

export const PLUGIN_API_VERSION = "yingce.plugin/v1" as const;
export const PLUGIN_API_VERSION_V2 = "yingce.plugin/v2" as const;

export type EditorSlotKind =
    | "timeline-panel"
    | "preview-renderer"
    | "inspector"
    | "asset-ingest"
    | "subtitle-tool"
    | "transcription-provider"
    | "export-renderer"
    | "ai-assistant";

export type EditorSlotContribution = {
    slot: EditorSlotKind;
    priority?: number;
};

export type EditorPluginPermission = "timeline.read" | "timeline.command" | "export.run";

export type PluginContributionKind = "provider" | "payment-provider" | "workflow" | "canvas-node" | "transform" | "command" | "asset-source" | "usage-observer" | "ai-capability" | "agent" | "import-export";
export type PluginSurface = "node" | "fullscreen" | "hybrid" | "asset-source" | "settings" | "wallet";
export type ProtocolCapability = "text" | "image" | "video" | "audio";
export type ProtocolScope = "admin.system-channel" | "user.custom-channel" | "canvas" | "creation" | "agent" | string;
export type PluginRuntime = "declarative" | "sandbox" | "worker" | "trusted-backend";
export type PluginField = {
    name: string;
    type: "string" | "number" | "boolean" | "secret" | "url" | "select" | "json";
    label?: string;
    required?: boolean;
    default?: string | number | boolean;
    description?: string;
    values?: string[];
};
export type PluginParameter = {
    name: string;
    type: string;
    required?: boolean;
    description?: string;
    values?: string[];
    mapping?: string;
};
export type PluginProviderOperation = {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    contentType?: string;
    fields?: Record<string, string>;
};
export type PluginProviderContribution = {
    id: string;
    label: string;
    capabilities: ProtocolCapability[];
    scopes: ProtocolScope[];
    baseUrl?: string;
    auth?: { type: "bearer" | "api-key" | "custom"; field: string; header?: string };
    parameters?: PluginParameter[];
    create: PluginProviderOperation;
    poll?: PluginProviderOperation;
    cancel?: PluginProviderOperation;
    response: {
        taskIdPaths?: string[];
        statusPaths?: string[];
        messagePaths?: string[];
        textPaths?: string[];
        reasoningPaths?: string[];
        resultPaths?: string[];
        resultKind?: "image" | "video" | "audio";
        resultEphemeral?: boolean;
    };
};
export type PluginWorkflowContribution = {
    id: string;
    label: string;
    providerId: string;
    capability: ProtocolCapability;
    parameters: PluginParameter[];
    defaults?: Record<string, string | number | boolean>;
};
export type PluginPaymentProviderContribution = {
    id: string;
    label: string;
    icon: string;
    checkoutMode: "qr_code" | "redirect";
    expiryPolicy: { defaultMinutes: number; minMinutes: number; maxMinutes: number };
};
export type PluginCanvasNodeContribution = {
    id: string;
    label: string;
    defaultTitle: string;
    defaultSize: { width: number; height: number };
    schema: Record<string, unknown>;
    renderer: "declarative" | "sandbox";
    /** Optional input contract for nodes that consume one or more media kinds. */
    acceptsInputKind?: "image" | "video" | "audio" | "text" | Array<"image" | "video" | "audio" | "text">;
    /** Optional maximum number of direct inputs. */
    maxInputCount?: number;
    /** Analysis/sink nodes can hide the right-side output connection. */
    showOutputConnection?: boolean;
};
export type PluginTransformContribution = {
    id: string;
    input: "media" | "generation";
    output: "provider-request" | "media";
    runtime: PluginRuntime;
};
export type PluginContributions = {
    providers?: PluginProviderContribution[];
    paymentProviders?: PluginPaymentProviderContribution[];
    workflows?: PluginWorkflowContribution[];
    canvasNodes?: PluginCanvasNodeContribution[];
    transforms?: PluginTransformContribution[];
    commands?: Array<{ id: string; label: string }>;
    assetSources?: string[];
    usageObservers?: string[];
    aiCapabilities?: string[];
    agents?: string[];
    importExport?: string[];
    /** Editor slot contributions are available to trusted v2 plugins. */
    editorSlots?: EditorSlotContribution[];
};

export type PluginContributionsV2 = PluginContributions & {
    editorSlots?: EditorSlotContribution[];
};
export type PluginPermission =
    | "canvas.read"
    | "canvas.write"
    | "asset.read"
    | "asset.search"
    | "asset.import"
    | "asset.upload"
    | "generation.run"
    | "ai.text"
    | "media.read"
    | "usage.read"
    | "payment.create"
    | "payment.query"
    | "payment.close"
    | "payment.reconcile"
    | "external.open";

export type PluginManifest = {
    apiVersion: typeof PLUGIN_API_VERSION | typeof PLUGIN_API_VERSION_V2;
    id: string;
    name: string;
    version: string;
    publishedAt?: string;
    updatedAt?: string;
    description: string;
    documentation?: string;
    author?: string;
    entry?: string;
    surfaces?: PluginSurface[];
    permissions: Array<PluginPermission | EditorPluginPermission>;
    trusted?: boolean;
    configuration?: { fields: PluginField[] };
    runtime?: { backend?: PluginRuntime; web?: PluginRuntime };
    contributes: PluginContributionsV2;
};

// Keep the common manifest type broad so v2 manifests stay usable at existing
// plugin call sites; this subtype still makes v2 declarations explicit.
export type PluginManifestV2 = Omit<PluginManifest, "apiVersion"> & {
    apiVersion: typeof PLUGIN_API_VERSION_V2;
};

export type PluginStorage = {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
};

export type PluginTextContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type PluginTextMessage = {
    role: "system" | "user" | "assistant";
    content: string | PluginTextContentPart[];
};

export type PluginTextTool = {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
        strict?: boolean;
    };
};

export type PluginTextToolChoice = "auto" | "required" | { type: "function"; name: string };

export type PluginTextToolCall = {
    name: string;
    arguments: string;
};

export type PluginTextResponse = {
    content: string;
    toolCalls: PluginTextToolCall[];
};

export type PluginTextRequest = {
    model?: string;
    messages: PluginTextMessage[];
    tools?: PluginTextTool[];
    toolChoice?: PluginTextToolChoice;
    signal?: AbortSignal;
    onDelta?: (text: string) => void;
};

export type PluginAiTextService = {
    requestToolResponse: (request: PluginTextRequest) => Promise<PluginTextResponse>;
};

export type PluginHostServices = {
    ai?: {
        text?: PluginAiTextService;
    };
    media?: {
        resolve: (reference: { url?: string; dataUrl?: string; kind?: string }, signal?: AbortSignal) => Promise<{ dataUrl: string; mimeType: string }>;
    };
    usage?: {
        list: (scope?: string) => Promise<ReadonlyArray<Record<string, unknown>>>;
    };
};

export type PluginHostContext = {
    manifest: PluginManifest;
    permissions: ReadonlySet<PluginPermission | EditorPluginPermission>;
    storage: PluginStorage;
    config: Readonly<PluginInstallation["config"]>;
    services?: PluginHostServices;
};

export type PromptOptimizationMode = "expand" | "refine" | "style" | "model-adapt" | "reference";

export type PromptOptimizationInput = {
    prompt: string;
    mode: PromptOptimizationMode;
    generationMode: "image" | "video";
    targetModel?: string;
    targetProtocol?: string;
    optimizerModel?: string;
    context?: {
        texts?: Array<{ title: string; text: string }>;
        images?: Array<{ title: string; url: string }>;
    };
};

export type PromptOptimizationVariant = {
    label: string;
    prompt: string;
};

export type PromptOptimizationResult = {
    optimizedPrompt: string;
    negativePrompt: string;
    changes: string[];
    assumptions: string[];
    variants: PromptOptimizationVariant[];
    modelProfile?: { id: string; label: string };
};

export type PromptOptimizerProvider = {
    optimize: (input: PromptOptimizationInput, options?: { signal?: AbortSignal; onDelta?: (text: string) => void }) => Promise<PromptOptimizationResult>;
};

export type AssetSourceQuery = {
    keyword?: string;
    folderId?: string;
    tags?: string[];
    kind?: Asset["kind"];
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
};

export type ExternalAssetFolder = {
    id: string;
    name: string;
    parentId?: string;
};

export type ExternalAssetItem = {
    id: string;
    title: string;
    kind: Asset["kind"];
    thumbnailUrl?: string;
    fileUrl?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    bytes?: number;
    tags?: string[];
    folderId?: string;
    folderIds?: string[];
    folderPath?: string[];
    description?: string;
    metadata?: Record<string, unknown>;
};

export type ExternalAssetPickerReference = {
    sourceId: string;
    sourceName: string;
    item: ExternalAssetItem;
};

export type AssetSourceProvider = {
    listFolders?: (signal?: AbortSignal) => Promise<ExternalAssetFolder[]>;
    list?: (query: AssetSourceQuery) => Promise<ExternalAssetItem[]>;
    importAsset?: (item: ExternalAssetItem, signal?: AbortSignal) => Promise<Asset>;
    uploadAsset?: (asset: Asset, signal?: AbortSignal) => Promise<ExternalAssetItem>;
    uploadAssetToFolder?: (asset: Asset, folderId?: string, signal?: AbortSignal) => Promise<ExternalAssetItem>;
    uploadFile?: (file: File, folderId?: string, signal?: AbortSignal) => Promise<ExternalAssetItem>;
    createFolder?: (name: string, parentId?: string) => Promise<void>;
    openAsset?: (item: ExternalAssetItem) => Promise<void>;
};

export type PluginAgentAction = {
    id: string;
    description: string;
    inputSchema: Record<string, unknown>;
    /** Pure planner: validate input and return operations, never perform side effects here. */
    buildOperations: (input: Record<string, unknown>, snapshot: import("@/lib/canvas/canvas-operation-contract").CanvasSnapshot) => import("@/lib/canvas/canvas-operation-contract").CanvasOperation[];
};

export type RegisteredPlugin = {
    agentActions?: PluginAgentAction[];
    /** Pure, bounded projection: never return embedded media or provider credentials. */
    readAgentNode?: (node: import("@/types/canvas").CanvasNodeData, snapshot: import("@/lib/canvas/canvas-operation-contract").CanvasSnapshot) => Record<string, unknown>;
    /** v1 and v2 manifests; v2 can declare editor slots. */
    manifest: PluginManifest;
    source?: "bundled" | "uploaded" | string;
    activate?: (context: PluginHostContext) => Promise<void> | void;
    deactivate?: (context: PluginHostContext) => Promise<void> | void;
    createAssetSource?: (context: PluginHostContext) => AssetSourceProvider;
    createPromptOptimizer?: (context: PluginHostContext) => PromptOptimizerProvider;
    /** v2 plugin editor slots extracted by the registry. */
    editorSlots?: EditorSlotContribution[];
};

export type PluginInstallation = {
    manifest: PluginManifest;
    enabled: boolean;
    config: Record<string, string | number | boolean>;
    installedAt: string;
    updatedAt: string;
    lastError?: string;
};
