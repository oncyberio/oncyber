import { decibelsToLevel } from "@utils/voiceChat/levels";

type Meter = {
    stream: MediaStream;
    track: MediaStreamTrack | undefined;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
};

/**
 * How loud each voice stream is, on the 0..1 scale spaces use (0.5 is
 * -50 dB; see utils/voiceChat/levels.ts). Analysis only: nothing here is
 * connected to the speakers. Without Web Audio every level reads 0.
 */
export class VoiceLevels {
    private context: AudioContext | null = null;
    private meters = new Map<string, Meter>();
    private samples: Float32Array | null = null;

    /** Measure `stream` as `id`; null stops measuring that id. */
    set(id: string, stream: MediaStream | null) {
        const current = this.meters.get(id);
        const track = stream?.getAudioTracks?.()[0];
        if (current && current.stream === stream && current.track === track)
            return;
        if (current) {
            try {
                current.source.disconnect();
            } catch {}
            this.meters.delete(id);
        }
        if (!stream || !track) return;
        try {
            const Context: typeof AudioContext =
                globalThis.AudioContext ||
                (globalThis as any).webkitAudioContext;
            if (!Context) return;
            this.context ||= new Context();
            const analyser = this.context.createAnalyser();
            analyser.fftSize = 1024;
            const source = this.context.createMediaStreamSource(stream);
            source.connect(analyser);
            this.meters.set(id, { stream, track, source, analyser });
        } catch (error) {
            console.warn("[game voice] cannot measure a voice:", error);
        }
    }

    /** A browser may hold the context until the visitor's first gesture. */
    resume() {
        if (this.context?.state === "suspended")
            void this.context.resume().catch(() => {});
    }

    private resumedAt = 0;

    levels(): Array<[string, number]> {
        const levels: Array<[string, number]> = [];
        // A listener who never touched the microphone: the context starts
        // once the browser has seen any gesture, in the game included.
        if (this.meters.size && Date.now() - this.resumedAt > 1000) {
            this.resumedAt = Date.now();
            this.resume();
        }
        this.meters.forEach((meter, id) => {
            // A muted microphone is silent whatever the room picks up.
            if (!meter.track?.enabled) return void levels.push([id, 0]);
            const size = meter.analyser.fftSize;
            if (this.samples?.length !== size)
                this.samples = new Float32Array(size);
            meter.analyser.getFloatTimeDomainData(this.samples as any);
            let sum = 0;
            for (let i = 0; i < size; i++)
                sum += this.samples[i] * this.samples[i];
            levels.push([
                id,
                decibelsToLevel(10 * Math.log10(sum / size)) || 0,
            ]);
        });
        return levels;
    }

    dispose() {
        this.meters.forEach((meter) => {
            try {
                meter.source.disconnect();
            } catch {}
        });
        this.meters.clear();
        void this.context?.close().catch(() => {});
        this.context = null;
    }
}
