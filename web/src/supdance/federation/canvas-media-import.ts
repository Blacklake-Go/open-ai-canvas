import { createCanvasNode } from "@/lib/canvas/canvas-project-domain";
import { fitImageNodeSize } from "@/lib/canvas/canvas-node-size";
import { assertCurrentUserSession, captureUserSession } from "@/lib/user-scope";
import { resourceFileUrl, resourceStorageKey, uploadResourceFile } from "@/services/api/resources";
import { prepareCanvasForCloudAction } from "@/services/user-data-sync";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useUserStore } from "@/stores/use-user-store";
import { CanvasNodeType } from "@/types/canvas";

export const canvasImportChannel = "supdance.one.canvas-media.v1";
export const maxCanvasImportBytes = 100 * 1024 * 1024;
const nodeTypes = { image: CanvasNodeType.Image, video: CanvasNodeType.Video, audio: CanvasNodeType.Audio };
const supportedMimes = /^(?:image\/(?:jpeg|png|webp|gif|avif)|video\/(?:mp4|webm|quicktime)|audio\/(?:mpeg|wav|ogg|mp4|aac|webm|flac))$/;
type MediaKind = keyof typeof nodeTypes;
type ImportOffer = { kind: MediaKind; port: MessagePort };
// The authenticated shell can remount the route after sign-in.
let handshake: { id: string; result: Promise<ImportOffer | null> } | undefined;

export function isImportKind(value: unknown): value is MediaKind {
    return typeof value === "string" && Object.hasOwn(nodeTypes, value);
}

export function parseCanvasImportRequest(hash: string) {
    const params = new URLSearchParams(hash.slice(1));
    const id = params.get("id") || "";
    const source = params.get("source") || "";
    const loopbackOrigin = import.meta.env.VITE_ONE_CANVAS_SOURCE_ORIGIN?.trim();
    const fromLocalTest = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(loopbackOrigin || "") && ["localhost", "127.0.0.1"].includes(window.location.hostname) && source === loopbackOrigin;
    if (!fromLocalTest && !["https://one.supdance.com", "https://www.supdance.com", "https://supdance.com"].includes(source)) return null;
    return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) ? { id, source } : null;
}

export function requestCanvasImportOffer(request: NonNullable<ReturnType<typeof parseCanvasImportRequest>>) {
    if (handshake?.id === request.id) return handshake.result;
    const opener = window.opener as Window | null;
    if (!opener) return Promise.resolve(null);
    const result = new Promise<ImportOffer | null>((resolve) => {
        function finish(offer: ImportOffer | null) {
            window.clearTimeout(timer);
            window.removeEventListener("message", receive);
            window.opener = null;
            resolve(offer);
        }
        function receive(event: MessageEvent) {
            if (event.source !== opener || event.origin !== request.source || event.data?.channel !== canvasImportChannel || event.data?.id !== request.id) return;
            if (event.data.phase !== "offer" || !isImportKind(event.data.kind) || !event.ports[0]) return;
            finish({ kind: event.data.kind, port: event.ports[0] });
        }
        const timer = window.setTimeout(() => finish(null), 12000);
        window.addEventListener("message", receive);
        opener.postMessage({ channel: canvasImportChannel, id: request.id, phase: "hello" }, request.source);
    });
    handshake = { id: request.id, result };
    return result;
}

export function isCanvasImportMedia(value: unknown, kind: MediaKind): value is Blob {
    return value instanceof Blob && value.size > 0 && value.size <= maxCanvasImportBytes && supportedMimes.test(value.type) && value.type.startsWith(kind + "/");
}

export async function saveCanvasImport({ id, kind, blob, title, recipient, signal }: { id: string; kind: MediaKind; blob: Blob; title: string; recipient: string; signal: AbortSignal }) {
    const session = captureUserSession();
    const verifyRecipient = () => {
        signal.throwIfAborted();
        assertCurrentUserSession(session);
        if (useUserStore.getState().user?.id !== recipient) throw new Error("Canvas account changed");
    };
    verifyRecipient();
    let dimensions: { width: number; height: number } | undefined;
    if (kind === "image") {
        const image = await createImageBitmap(blob);
        dimensions = { width: image.width, height: image.height };
        image.close();
    }
    verifyRecipient();
    const resource = await uploadResourceFile(blob, kind, {
        ...dimensions,
        expectedUserId: recipient,
        idempotencyKey: `one-canvas-${id}`,
        signal: AbortSignal.any([signal, session.signal]),
    });
    verifyRecipient();
    if (resource.status !== "ready" || resource.userId !== recipient || !resource.id) throw new Error("Canvas resource is unavailable");
    const storageKey = resourceStorageKey(resource.id);
    const store = useCanvasStore.getState();
    const current = store.openProject(id);
    if (!current) {
        const node = createCanvasNode(
            nodeTypes[kind],
            { x: 320, y: 220 },
            {
                content: resourceFileUrl(resource.id),
                storageKey,
                mimeType: resource.mimeType,
                bytes: resource.size,
                status: "success",
                naturalWidth: dimensions?.width || resource.width,
                naturalHeight: dimensions?.height || resource.height,
                durationMs: resource.durationMs,
            },
        );
        const size = dimensions ? fitImageNodeSize(dimensions.width, dimensions.height) : {};
        store.createDraftProject(title, id);
        store.updateProject(id, { nodes: [{ ...node, ...size, title }] });
    } else if (!current.nodes.some((node) => node.metadata?.storageKey === storageKey)) {
        throw new Error("Canvas import does not match the existing project");
    }
    await prepareCanvasForCloudAction(id);
    verifyRecipient();
    return id;
}
