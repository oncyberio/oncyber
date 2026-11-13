import { mungeMicOpus } from "./sdp";

const crlf = (lines: string[]) => lines.join("\r\n") + "\r\n";

const SESSION = [
    "v=0",
    "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0 1 2",
    "a=msid-semantic: WMS micStream111 ssStream222",
];

// mic audio — mid 0, opus PT 111, red PT 63 whose fmtp contains "111"
const MIC_AUDIO = [
    "m=audio 9 UDP/TLS/RTP/SAVPF 111 63 9 0 8",
    "c=IN IP4 0.0.0.0",
    "a=mid:0",
    "a=sendrecv",
    "a=msid:micStream111 micTrack111",
    "a=rtcp-mux",
    "a=rtpmap:111 opus/48000/2",
    "a=rtcp-fb:111 transport-cc",
    "a=fmtp:111 minptime=10;useinbandfec=1",
    "a=rtpmap:63 red/48000/2",
    "a=fmtp:63 111/111",
    "a=rtpmap:9 G722/8000",
    "a=ssrc:1111 cname:foo",
    "a=ssrc:1111 msid:micStream111 micTrack111",
];

// screenshare audio — mid 1, SAME payload types as the mic section
const SS_AUDIO = [
    "m=audio 9 UDP/TLS/RTP/SAVPF 111 63 9 0 8",
    "c=IN IP4 0.0.0.0",
    "a=mid:1",
    "a=sendrecv",
    "a=msid:ssStream222 ssAudioTrack222",
    "a=rtcp-mux",
    "a=rtpmap:111 opus/48000/2",
    "a=fmtp:111 minptime=10;useinbandfec=1",
    "a=rtpmap:63 red/48000/2",
    "a=fmtp:63 111/111",
    "a=ssrc:2222 cname:foo",
];

const VIDEO = [
    "m=video 9 UDP/TLS/RTP/SAVPF 96 97",
    "c=IN IP4 0.0.0.0",
    "a=mid:2",
    "a=sendrecv",
    "a=msid:ssStream222 ssVideoTrack222",
    "a=rtpmap:96 VP8/90000",
    "a=rtcp-fb:96 nack",
    "a=rtpmap:97 rtx/90000",
    "a=fmtp:97 apt=96",
    "a=ssrc:3333 cname:foo",
];

const OFFER = crlf([...SESSION, ...MIC_AUDIO, ...SS_AUDIO, ...VIDEO]);

function sectionOf(sdp: string, mid: string): string {
    const sections = sdp.split(/(?=m=)/);
    return sections.find((s) => s.includes(`a=mid:${mid}\r\n`)) || "";
}

function fmtpParams(section: string, pt: string): Record<string, string> {
    const line = section
        .split("\r\n")
        .find((l) => l.startsWith(`a=fmtp:${pt} `));
    if (!line) return null;
    const params: Record<string, string> = {};
    line.slice(`a=fmtp:${pt} `.length)
        .split(";")
        .forEach((p) => {
            const [k, v] = p.split("=");
            params[k] = v;
        });
    return params;
}

describe("mungeMicOpus", () => {
    test("takes a lower cap for crowded lobby voice", () => {
        const out = mungeMicOpus(OFFER, new Set(["0"]), 16000);
        expect(fmtpParams(sectionOf(out, "0"), "111").maxaveragebitrate).toBe(
            "16000"
        );
    });

    test("munges only the mic m-section, preserving existing params", () => {
        const out = mungeMicOpus(OFFER, new Set(["0"]));

        const mic = sectionOf(out, "0");
        expect(fmtpParams(mic, "111")).toEqual({
            minptime: "10",
            stereo: "0",
            maxaveragebitrate: "24000",
            useinbandfec: "1",
            usedtx: "1",
        });
        expect(mic).toContain("a=ptime:40\r\n");

        // red fmtp containing "111" untouched
        expect(mic).toContain("a=fmtp:63 111/111\r\n");

        // screenshare audio + video sections byte-identical
        expect(sectionOf(out, "1")).toBe(sectionOf(OFFER, "1"));
        expect(sectionOf(out, "2")).toBe(sectionOf(OFFER, "2"));
    });

    test("empty micMids returns the sdp unchanged", () => {
        expect(mungeMicOpus(OFFER, new Set())).toBe(OFFER);
    });

    test("unknown mid returns the sdp unchanged", () => {
        expect(mungeMicOpus(OFFER, new Set(["9"]))).toBe(OFFER);
    });

    test("inserts an fmtp line after the opus rtpmap when missing", () => {
        const noFmtp = crlf([
            ...SESSION,
            ...MIC_AUDIO.filter(
                (l) => l !== "a=fmtp:111 minptime=10;useinbandfec=1"
            ),
        ]);

        const out = mungeMicOpus(noFmtp, new Set(["0"]));
        const lines = sectionOf(out, "0").split("\r\n");

        const rtpmapIndex = lines.indexOf("a=rtpmap:111 opus/48000/2");
        expect(lines[rtpmapIndex + 1]).toBe(
            "a=fmtp:111 stereo=0;maxaveragebitrate=24000;useinbandfec=1;usedtx=1"
        );
    });

    test("skips rejected m-sections (port 0)", () => {
        const rejected = crlf([
            ...SESSION,
            "m=audio 0 UDP/TLS/RTP/SAVPF 111",
            "c=IN IP4 0.0.0.0",
            "a=mid:0",
            "a=inactive",
        ]);

        expect(mungeMicOpus(rejected, new Set(["0"]))).toBe(rejected);
    });

    test("handles Firefox-style opus payload type", () => {
        const ff = crlf([
            ...SESSION,
            "m=audio 9 UDP/TLS/RTP/SAVPF 109",
            "c=IN IP4 0.0.0.0",
            "a=mid:0",
            "a=sendrecv",
            "a=rtpmap:109 opus/48000/2",
            "a=fmtp:109 maxplaybackrate=48000;stereo=1;useinbandfec=1",
        ]);

        const out = mungeMicOpus(ff, new Set(["0"]));
        expect(fmtpParams(sectionOf(out, "0"), "109")).toEqual({
            maxplaybackrate: "48000",
            stereo: "0",
            maxaveragebitrate: "24000",
            useinbandfec: "1",
            usedtx: "1",
        });
    });

    test("is idempotent", () => {
        const once = mungeMicOpus(OFFER, new Set(["0"]));
        expect(mungeMicOpus(once, new Set(["0"]))).toBe(once);
    });

    test("preserves CRLF line endings", () => {
        const out = mungeMicOpus(OFFER, new Set(["0"]));
        expect(out.includes("\r\n")).toBe(true);
        // no bare \n anywhere
        expect(/[^\r]\n/.test(out)).toBe(false);
        expect(out.endsWith("\r\n")).toBe(true);
    });

    test("audio section with no opus codec is untouched", () => {
        const noOpus = crlf([
            ...SESSION,
            "m=audio 9 UDP/TLS/RTP/SAVPF 9",
            "c=IN IP4 0.0.0.0",
            "a=mid:0",
            "a=rtpmap:9 G722/8000",
        ]);

        expect(mungeMicOpus(noOpus, new Set(["0"]))).toBe(noOpus);
    });
});
