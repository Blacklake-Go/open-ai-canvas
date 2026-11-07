// All selection boundaries are sample frames. The end frame is exclusive.
export const MAX_INPUT = 48 * 1024 * 1024;
export const MAX_DECODED = 160 * 1024 * 1024;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type TrimRange = [number, number];
export type TrimEdge = "start" | "end";
type Samples = Pick<AudioBuffer, "length" | "numberOfChannels" | "sampleRate" | "getChannelData">;

export function assertEditableAudio({ length, numberOfChannels }: Pick<AudioBuffer, "length" | "numberOfChannels">) {
    if (!Number.isSafeInteger(length) || length < 1 || !Number.isInteger(numberOfChannels) || numberOfChannels < 1) throw new Error("Invalid audio");
    if (numberOfChannels > 8 || length * numberOfChannels * 4 > MAX_DECODED) throw new RangeError("Audio exceeds editing capacity");
}

export function previewWindow([start, end]: TrimRange, cursor: number, sampleRate: number) {
    const rounded = Math.round(cursor);
    const frame = rounded >= end ? start : Math.max(start, rounded);
    return { frame, offset: frame / sampleRate, duration: (end - frame) / sampleRate };
}

export function trimFrames(length: number, sampleRate: number, start: number, end: number, edge: TrimEdge = "end"): TrimRange {
    if (!Number.isSafeInteger(length) || length <= 0 || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(start) || !Number.isFinite(end)) throw new RangeError("Invalid selection");
    const gap = Math.min(length, Math.ceil(sampleRate * 0.05));
    if (edge === "start") {
        end = clamp(Math.round(end), gap, length);
        return [clamp(Math.round(start), 0, end - gap), end];
    }
    start = clamp(Math.round(start), 0, length - gap);
    return [start, clamp(Math.round(end), start + gap, length)];
}

export function waveformPeaks(buffer: Samples, bars = 200) {
    if (!Number.isInteger(bars) || bars < 1) throw new RangeError("Invalid waveform resolution");
    bars = Math.min(bars, buffer.length);
    const peaks = new Float32Array(bars);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const samples = buffer.getChannelData(c);
        for (let i = 0; i < bars; i++) {
            const last = Math.floor(((i + 1) * samples.length) / bars);
            let peak = peaks[i];
            for (let j = Math.floor((i * samples.length) / bars); j < last; j++) {
                const absolute = Math.abs(samples[j]);
                if (absolute > peak) peak = absolute;
            }
            peaks[i] = peak;
        }
    }
    return peaks;
}

export function encodeTrimWav(buffer: Samples, start: number, end: number) {
    const { length, numberOfChannels: channels, sampleRate } = buffer;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > length || end <= start || !Number.isInteger(channels) || channels < 1 || channels > 8 || !Number.isInteger(sampleRate) || sampleRate <= 0)
        throw new RangeError("Invalid audio range");
    const byteCount = (end - start) * channels * 2;
    if (byteCount > MAX_DECODED / 2) throw new RangeError("Audio selection too large");
    const bytes = new ArrayBuffer(44 + byteCount);
    const view = new DataView(bytes);
    const tag = (offset: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };
    tag(0, "RIFF");
    view.setUint32(4, 36 + byteCount, true);
    tag(8, "WAVE");
    tag(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    tag(36, "data");
    view.setUint32(40, byteCount, true);
    const tracks = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
    let offset = 44;
    for (let i = start; i < end; i++) {
        for (const track of tracks) {
            const v = clamp(track[i], -1, 1);
            view.setInt16(offset, Math.round(v < 0 ? v * 32768 : v * 32767), true);
            offset += 2;
        }
    }
    return new Blob([bytes], { type: "audio/wav" });
}
