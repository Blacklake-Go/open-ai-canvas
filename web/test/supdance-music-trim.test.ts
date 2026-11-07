import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { assertEditableAudio, encodeTrimWav, MAX_DECODED, MAX_INPUT, previewWindow, trimFrames, waveformPeaks } from "../src/supdance/plugins/music-generation/components/music-trim-audio";
import { readMusicTrimSource } from "../src/supdance/plugins/music-generation/services/music-trim-source";

const samples = (channels: number[][], sampleRate = 8000) => {
    const tracks = channels.map((c) => Float32Array.from(c));
    return { length: tracks[0].length, numberOfChannels: tracks.length, sampleRate, getChannelData: (index: number) => tracks[index] };
};
afterEach(() => mock.restore());

test("trim: WAV contains only the selected frames, interleaved, PCM16 little-endian", async () => {
    const buffer = samples([
        [0.8, -2, 0.5, 0.7],
        [0.9, 2, -0.5, -0.7],
    ]);
    const wav = encodeTrimWav(buffer, 1, 3);
    const bytes = await wav.arrayBuffer();
    const view = new DataView(bytes);
    expect(wav.type).toBe("audio/wav");
    expect(bytes.byteLength).toBe(52);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(44);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(28, true)).toBe(32000);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect([44, 46, 48, 50].map((i) => view.getInt16(i, true))).toEqual([-32768, 32767, 16384, -16384]);
    expect(Array.from(buffer.getChannelData(0)).slice(1, 3)).toEqual([-2, 0.5]);
});

test("trim: boundaries keep the moving handle inside the file with at least 50 ms or the whole shorter file", () => {
    expect(trimFrames(16000, 8000, -20, 16000, "start")).toEqual([0, 16000]);
    expect(trimFrames(16000, 8000, 6000, 6100, "start")).toEqual([5700, 6100]);
    expect(trimFrames(16000, 8000, 6000, 400, "end")).toEqual([6000, 6400]);
    expect(trimFrames(80, 8000, 75, 10000, "start")).toEqual([0, 80]);
    expect(() => trimFrames(10, 8000, NaN, 5)).toThrow();
    const buf = samples([[0, 1]]);
    for (const [s, e] of [
        [-1, 1],
        [1, 1],
        [0, 3],
        [0.5, 1],
        [0, Infinity],
    ])
        expect(() => encodeTrimWav(buf, s, e)).toThrow();
});

test("trim: auditioning resumes inside the selection, starts again at the end and always stops at the exclusive end frame", () => {
    expect(previewWindow([800, 4000], 0, 8000)).toEqual({ frame: 800, offset: 0.1, duration: 0.4 });
    expect(previewWindow([800, 4000], 2400, 8000)).toEqual({ frame: 2400, offset: 0.3, duration: 0.2 });
    for (const atEnd of [4000, 4200, 3999.8]) expect(previewWindow([800, 4000], atEnd, 8000).frame).toBe(800);
});

test("trim: waveform samples all channels including the last partial bucket and silence", () => {
    expect(
        Array.from(
            waveformPeaks(
                samples([
                    [0, -0.25, 0, 0, 0],
                    [0, 0, 0, 0, -0.875],
                ]),
                2,
            ),
        ),
    ).toEqual([0.25, 0.875]);
    expect(Array.from(waveformPeaks(samples([[0, 0]])))).toEqual([0, 0]);
});

test("trim: decoded capacity checked before building peaks and allocating the output", () => {
    expect(() => assertEditableAudio({ length: MAX_DECODED / 8, numberOfChannels: 2 })).not.toThrow();
    expect(() => assertEditableAudio({ length: MAX_DECODED / 8 + 1, numberOfChannels: 2 })).toThrow(RangeError);
    expect(() => assertEditableAudio({ length: 200, numberOfChannels: 9 })).toThrow(RangeError);
    expect(() => assertEditableAudio({ length: 0, numberOfChannels: 1 })).toThrow();
});

test("trim: checks response status, rejects oversized content and cancels a stream with no content length", async () => {
    const abort = new AbortController();
    const read = () => readMusicTrimSource("https://example.invalid/track", undefined, abort.signal, false);
    const fetcher = spyOn(globalThis, "fetch");
    fetcher.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    await expect(read()).rejects.toThrow("could not be read");
    fetcher.mockResolvedValueOnce(new Response("bytes", { headers: { "content-length": String(MAX_INPUT + 1) } }));
    await expect(read()).rejects.toThrow(RangeError);
    let canceled = false;
    const chunk = new Uint8Array(MAX_INPUT / 2 + 1);
    fetcher.mockResolvedValueOnce(
        new Response(
            new ReadableStream({
                pull(controller) {
                    controller.enqueue(chunk);
                },
                cancel() {
                    canceled = true;
                },
            }),
        ),
    );
    await expect(read()).rejects.toThrow(RangeError);
    expect(canceled).toBe(true);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: "same-origin", signal: abort.signal });
});

test("trim: Blob sources stay local and truncated or oversized selections are rejected", async () => {
    class HugeFile extends Blob {
        override get size() {
            return MAX_INPUT + 1;
        }
    }
    const signal = new AbortController().signal;
    const fetcher = spyOn(globalThis, "fetch");
    await expect(readMusicTrimSource(new HugeFile(), undefined, signal, false)).rejects.toThrow(RangeError);
    const file = await readMusicTrimSource(new Blob(["abc"]), undefined, signal, false);
    expect(await file.text()).toBe("abc");
    expect(fetcher).not.toHaveBeenCalled();
});
