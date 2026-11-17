/**
 * E2E Test Suite Helpers for App Store & TapTV Pages
 *
 * Provides opaque-box AST scanners, token validators, DOM harnesses,
 * and media element mock fixtures.
 */

import { Window } from "happy-dom";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// Base directories
export const WEB_ROOT = resolve(import.meta.dir, "../..");
export const PUBLIC_DIR = join(WEB_ROOT, "public");
export const SHORT_DRAMA_STYLES_DIR = join(PUBLIC_DIR, "short-drama-styles");
export const PAGES_APP_STORE_DIR = join(WEB_ROOT, "src/pages/app-store");
export const PAGES_TAPTV_DIR = join(WEB_ROOT, "src/pages/taptv");

/**
 * Reads source file from web directory.
 */
export async function readSourceFile(relativePath: string): Promise<string> {
    const fullPath = resolve(WEB_ROOT, relativePath);
    return await Bun.file(fullPath).text();
}

/**
 * Checks for forbidden gradient tokens in CSS/Tailwind:
 * - linear-gradient, radial-gradient, conic-gradient
 * - bg-gradient-*, from-*, via-*, to-*
 * Excludes comments and non-styling strings where appropriate.
 */
export function scanCodeForGradients(code: string): {
    forbiddenTokens: string[];
    hasGradients: boolean;
    tokenCounts: Record<string, number>;
} {
    // Strip comments to inspect code tokens
    const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    const patterns: { token: string; regex: RegExp }[] = [
        { token: "linear-gradient", regex: /linear-gradient/gi },
        { token: "radial-gradient", regex: /radial-gradient/gi },
        { token: "conic-gradient", regex: /conic-gradient/gi },
        { token: "bg-gradient", regex: /bg-gradient-[a-z0-9-]+/gi },
        { token: "from-gradient", regex: /\bfrom-[a-z0-9/.-]+/gi },
        { token: "via-gradient", regex: /\bvia-[a-z0-9/.-]+/gi },
        { token: "to-gradient", regex: /\bto-[a-z0-9/.-]+/gi },
    ];

    const forbiddenTokens: string[] = [];
    const tokenCounts: Record<string, number> = {};

    for (const { token, regex } of patterns) {
        const matches = stripped.match(regex);
        if (matches && matches.length > 0) {
            forbiddenTokens.push(token);
            tokenCounts[token] = matches.length;
        }
    }

    return {
        forbiddenTokens,
        hasGradients: forbiddenTokens.length > 0,
        tokenCounts,
    };
}

/**
 * Emoji detector for raw Unicode emoji characters and iconEmoji fields.
 */
export function scanCodeForEmojis(code: string): {
    emojis: string[];
    hasEmojis: boolean;
    hasIconEmojiField: boolean;
} {
    // Unicode regex for Extended Pictographic (emojis)
    // Exclude basic punctuation and symbols that are not emojis
    const emojiRegex = /[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = code.match(emojiRegex) || [];

    const hasIconEmojiField = /\biconEmoji\b/.test(code);

    return {
        emojis: matches,
        hasEmojis: matches.length > 0,
        hasIconEmojiField,
    };
}

/**
 * Scans code for dead or forbidden external remote asset URLs (e.g. fe-assets.tapnow.media).
 */
export function scanRemoteAssetUrls(code: string): {
    remoteUrls: string[];
    hasBrokenRemoteUrls: boolean;
} {
    const brokenDomainRegex = /https?:\/\/fe-assets\.tapnow\.media[^\s"'`)]+/g;
    const matches = code.match(brokenDomainRegex) || [];

    return {
        remoteUrls: matches,
        hasBrokenRemoteUrls: matches.length > 0,
    };
}

/**
 * Scans code for window.alert() or alert() calls.
 */
export function scanAlertCalls(code: string): {
    alertCount: number;
    matches: string[];
} {
    // Strip comments
    const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    const alertRegex = /\b(?:window\.)?alert\s*\(/g;
    const matches = stripped.match(alertRegex) || [];

    return {
        alertCount: matches.length,
        matches,
    };
}

/**
 * Validates local 4K cinema assets under web/public/short-drama-styles/.
 */
export function verifyLocalCinemaAssets(paths?: string[]): {
    valid: boolean;
    existing: string[];
    missing: string[];
    allPublicAssets: string[];
} {
    const allPublicAssets: string[] = [];
    if (existsSync(SHORT_DRAMA_STYLES_DIR)) {
        const files = readdirSync(SHORT_DRAMA_STYLES_DIR);
        for (const file of files) {
            if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
                allPublicAssets.push(`/short-drama-styles/${file}`);
            }
        }
    }

    const testPaths = paths || [
        "/short-drama-styles/wuxia-swordsman.jpg",
        "/short-drama-styles/future-tech.jpg",
        "/short-drama-styles/cg-realistic.jpg",
        "/short-drama-styles/cyberpunk-neon.jpg",
        "/short-drama-styles/palace-hanfu.jpg",
        "/short-drama-styles/retro-film.jpg",
        "/short-drama-styles/fantasy-3d.jpg",
        "/short-drama-styles/space-opera.jpg",
        "/short-drama-styles/chinese-2d.jpg",
        "/short-drama-styles/film-noir.jpg",
    ];

    const existing: string[] = [];
    const missing: string[] = [];

    for (const p of testPaths) {
        const localRel = p.startsWith("/") ? p.slice(1) : p;
        const full = join(PUBLIC_DIR, localRel);
        if (existsSync(full) && statSync(full).size > 0) {
            existing.push(p);
        } else {
            missing.push(p);
        }
    }

    return {
        valid: missing.length === 0,
        existing,
        missing,
        allPublicAssets,
    };
}

/**
 * Runs a callback with a safely managed happy-dom Window.
 */
export function withHappyDom<T>(callback: (dom: Window) => T): T {
    const dom = new Window({ url: "http://localhost:3000/home/app-store" });
    const origWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const origDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
    const origNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const origLoc = Object.getOwnPropertyDescriptor(globalThis, "location");
    const origStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

    // In-memory localStorage mock
    const storageStore: Record<string, string> = {};
    const mockStorage = {
        getItem: (k: string) => storageStore[k] ?? null,
        setItem: (k: string, v: string) => {
            storageStore[k] = String(v);
        },
        removeItem: (k: string) => {
            delete storageStore[k];
        },
        clear: () => {
            for (const key of Object.keys(storageStore)) delete storageStore[key];
        },
        get length() {
            return Object.keys(storageStore).length;
        },
        key: (i: number) => Object.keys(storageStore)[i] ?? null,
    };

    Object.defineProperty(globalThis, "window", { configurable: true, value: dom });
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.navigator });
    Object.defineProperty(globalThis, "location", { configurable: true, value: dom.location });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: mockStorage });

    try {
        return callback(dom);
    } finally {
        if (origWindow) Object.defineProperty(globalThis, "window", origWindow);
        else Reflect.deleteProperty(globalThis, "window");

        if (origDoc) Object.defineProperty(globalThis, "document", origDoc);
        else Reflect.deleteProperty(globalThis, "document");

        if (origNav) Object.defineProperty(globalThis, "navigator", origNav);
        else Reflect.deleteProperty(globalThis, "navigator");

        if (origLoc) Object.defineProperty(globalThis, "location", origLoc);
        else Reflect.deleteProperty(globalThis, "location");

        if (origStorage) Object.defineProperty(globalThis, "localStorage", origStorage);
        else Reflect.deleteProperty(globalThis, "localStorage");
    }
}

/**
 * Creates an interactive mock HTMLVideoElement instance for media behavior tests.
 */
export function createMockVideoElement(initialSrc: string = "/test-stream.mp4") {
    let _currentTime = 0;
    let _duration = 120.0;
    let _volume = 1.0;
    let _muted = false;
    let _paused = true;
    let _playbackRate = 1.0;
    let _src = initialSrc;
    const listeners: Record<string, Function[]> = {};

    return {
        get src() {
            return _src;
        },
        set src(v: string) {
            _src = v;
            this.emit("loadstart");
            this.emit("durationchange");
            this.emit("loadedmetadata");
        },
        get currentTime() {
            return _currentTime;
        },
        set currentTime(t: number) {
            // Clamping
            _currentTime = Math.max(0, Math.min(t, _duration));
            this.emit("timeupdate");
            this.emit("seeked");
        },
        get duration() {
            return _duration;
        },
        set duration(d: number) {
            _duration = d;
            this.emit("durationchange");
        },
        get volume() {
            return _volume;
        },
        set volume(v: number) {
            _volume = Math.max(0, Math.min(v, 1));
            this.emit("volumechange");
        },
        get muted() {
            return _muted;
        },
        set muted(m: boolean) {
            _muted = m;
            this.emit("volumechange");
        },
        get paused() {
            return _paused;
        },
        get playbackRate() {
            return _playbackRate;
        },
        set playbackRate(r: number) {
            _playbackRate = r;
        },
        buffered: {
            length: 1,
            start: (_idx: number) => 0,
            end: (_idx: number) => _duration * 0.8,
        },
        play: async function () {
            _paused = false;
            this.emit("play");
            this.emit("playing");
            return Promise.resolve();
        },
        pause: function () {
            _paused = true;
            this.emit("pause");
        },
        addEventListener: function (event: string, fn: Function) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
        },
        removeEventListener: function (event: string, fn: Function) {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter((cb) => cb !== fn);
            }
        },
        emit: function (event: string, data?: any) {
            if (listeners[event]) {
                for (const fn of listeners[event]) {
                    fn({ type: event, target: this, ...data });
                }
            }
        },
    };
}
