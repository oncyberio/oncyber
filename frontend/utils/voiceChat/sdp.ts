// Munges the Opus fmtp of mic m-sections in a REMOTE SDP before it is
// applied with setRemoteDescription. libwebrtc configures the local encoder
// from the last applied remote description, so this caps what WE send on
// those m-sections. Both ends run this code, so both directions get capped.

// Speech only; shared audio/video keeps its original encoding parameters.
export const MIC_MAX_BITRATE = 24000;
export const MIC_PACKET_TIME = 40;

const MIC_OPUS_FMTP: Record<string, string> = {
    stereo: "0",
    maxaveragebitrate: String(MIC_MAX_BITRATE),
    useinbandfec: "1",
    usedtx: "1",
};

export function mungeMicOpus(sdp: string, micMids: Set<string>): string {
    //
    if (!micMids || micMids.size === 0) return sdp;

    const eol = sdp.includes("\r\n") ? "\r\n" : "\n";

    const sections = sdp.split(/(?=^m=)/m);

    return sections
        .map((section) => {
            if (!section.startsWith("m=audio")) return section;

            // rejected m-section (port 0)
            if (/^m=audio 0\s/.test(section)) return section;

            const mid = section.match(/^a=mid:(.+?)\r?$/m);

            if (!mid || !micMids.has(mid[1])) return section;

            return mungeSection(section, eol);
        })
        .join("");
}

function mungeSection(section: string, eol: string): string {
    //
    const lines = section.split(eol);

    const opusPts: Array<{ pt: string; index: number }> = [];

    lines.forEach((line, index) => {
        const m = line.match(/^a=rtpmap:(\d+) opus\/48000\/2/i);
        if (m) opusPts.push({ pt: m[1], index });
    });

    if (opusPts.length === 0) return section;

    // iterate in reverse so fmtp insertions don't shift earlier indexes
    for (let i = opusPts.length - 1; i >= 0; i--) {
        const { pt, index } = opusPts[i];

        const prefix = `a=fmtp:${pt} `;

        const fmtpIndex = lines.findIndex((l) => l.startsWith(prefix));

        if (fmtpIndex >= 0) {
            lines[fmtpIndex] =
                prefix + mergeFmtp(lines[fmtpIndex].slice(prefix.length));
        } else {
            lines.splice(index + 1, 0, prefix + mergeFmtp(""));
        }
    }

    if (!lines.some((l) => /^a=ptime:/.test(l))) {
        // append at the end of the section, before the trailing empty
        // element left by the final line break
        const at =
            lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
        lines.splice(at, 0, `a=ptime:${MIC_PACKET_TIME}`);
    }

    return lines.join(eol);
}

function mergeFmtp(existing: string): string {
    //
    const params = new Map<string, string>();

    existing
        .split(";")
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((p) => {
            const eq = p.indexOf("=");
            if (eq < 0) {
                params.set(p, "");
            } else {
                params.set(p.slice(0, eq), p.slice(eq + 1));
            }
        });

    for (const key in MIC_OPUS_FMTP) {
        params.set(key, MIC_OPUS_FMTP[key]);
    }

    return Array.from(params.entries())
        .map(([k, v]) => (v === "" ? k : `${k}=${v}`))
        .join(";");
}
