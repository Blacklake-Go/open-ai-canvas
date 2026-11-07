import type { StyleTemplate } from "./composer-patterns";

type Profile = { wave: OscillatorType; bass: number[]; notes: number[]; length: number; kit?: string; swing?: number };
const profiles: Record<StyleTemplate["voice"], Profile> = {
    ballad: { wave: "sine", bass: [0, -5, -3, -7], notes: [0, 4, 7, 12, 9, 7, 4, 2], length: 0.85 },
    pulse: { wave: "sawtooth", bass: [0, 0, -4, -2], notes: [0, 7, 12, 7, 0, 3, 10, 7], length: 0.23, kit: "dance" },
    swing: { wave: "triangle", bass: [0, 5, 2, 7], notes: [0, 3, 7, 10, 14, 10, 7, 3], length: 0.6, kit: "swing", swing: 0.18 },
    pop: { wave: "triangle", bass: [0, -5, -3, -7], notes: [0, 4, 7, 9, 12, 9, 7, 4], length: 0.8, kit: "pop" },
    pluck: { wave: "triangle", bass: [0, 5, 7, 0], notes: [0, 2, 7, 9, 12, 7, 4, 2], length: 0.48 },
    hop: { wave: "sine", bass: [0, -5, -2, -7], notes: [0, 3, 7, 10, 7, 3, 5, 2], length: 0.64, kit: "hop", swing: 0.12 },
    rock: { wave: "sawtooth", bass: [0, -5, -2, 0], notes: [0, 0, 7, 7, 12, 7, 10, 7], length: 0.36, kit: "rock" },
    ambient: { wave: "sine", bass: [0, -5, 3, 0], notes: [0, 7, 14, 10, 7, 14, 17, 10], length: 2.4 },
    folk: { wave: "triangle", bass: [0, 5, -5, 0], notes: [0, 7, 4, 12, 7, 4, 9, 7], length: 0.65, kit: "folk" },
    club: { wave: "square", bass: [0, 0, -3, -5], notes: [0, 7, 10, 7, 12, 7, 10, 3], length: 0.23, kit: "dance" },
};

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

export function playTemplateSketch(ctx: AudioContext, p: StyleTemplate, finished: () => void) {
    const profile = profiles[p.voice];
    const beat = 60 / p.bpm;
    const start = ctx.currentTime + 0.045;
    const end = start + beat * 16;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.65, start);
    master.gain.setValueAtTime(0.65, end - 0.22);
    master.gain.linearRampToValueAtTime(0, end);
    // Keep the composition envelope independent of live player volume changes.
    const output = ctx.createGain();
    master.connect(output).connect(ctx.destination);
    const soft = ctx.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = ["club", "rock", "pulse"].includes(p.voice) ? 1600 : 3800;
    soft.connect(master);
    function note(wave: OscillatorType, midi: number, at: number, length: number, volume: number, attack = 0.008, bend = false) {
        const osc = ctx.createOscillator();
        const envelope = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(hz(midi), at);
        if (bend) osc.frequency.exponentialRampToValueAtTime(43, at + length * 0.8);
        envelope.gain.setValueAtTime(0.0001, at);
        envelope.gain.linearRampToValueAtTime(volume, at + attack);
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
        osc.connect(envelope).connect(soft);
        osc.start(at);
        osc.stop(at + length + 0.01);
    }
    // Reuse one noise buffer for all the percussion hits in this audition.
    const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.14), ctx.sampleRate);
    const samples = noise.getChannelData(0);
    let seed = 31 + p.root;
    for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = seed / 2147483648 - 1;
    }
    function hit(at: number, snare: boolean) {
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        source.buffer = noise;
        filter.type = "highpass";
        filter.frequency.value = snare ? 1150 : 5700;
        const duration = snare ? 0.12 : 0.047;
        gain.gain.setValueAtTime(snare ? 0.115 : 0.075, at);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        source.connect(filter).connect(gain).connect(master);
        source.start(at, 0, duration);
    }
    for (let bar = 0; bar < 4; bar++) {
        const root = p.root + profile.bass[bar];
        for (let step = 0; step < 8; step++) {
            const at = start + beat * (bar * 4 + step / 2 + (step % 2 ? (profile.swing ?? 0) : 0));
            const melody = root + 12 + profile.notes[(step + (bar % 2) * 2) % 8];
            if (p.voice !== "ambient" || step % 2 === 0) {
                note(profile.wave, melody, at, beat * profile.length, profile.wave === "sawtooth" ? 0.11 : 0.16, p.voice === "ambient" ? 0.14 : 0.008);
            }
            if (step === 0 || step === 4) note("sine", root - 12 + (step === 4 && p.voice === "swing" ? 7 : 0), at, beat * 1.6, 0.26);
            if (!profile.kit) continue;
            const kick = profile.kit === "dance" ? step % 2 === 0 : step === 0 || (step === 5 && profile.kit === "hop") || step === 4;
            if (kick) note("sine", 42, at, 0.15, 0.33, 0.004, true);
            if (step === 2 || step === 6) hit(at, true);
            if (step % 2) hit(at, false);
        }
    }
    // Use the audio clock to stop on time if the tab's timers are throttled.
    const timer = ctx.createBufferSource();
    timer.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    timer.connect(master);
    timer.onended = finished;
    timer.start(end);
    return output;
}
