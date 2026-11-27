/**
 * What a game's field health asks of whoever made it: the numbers from
 * real visits (./gameHealthSummary.ts), read against the budgets a game is
 * held to, as findings in the form the check's are (a code, and a sentence
 * that says what to do). `oncyber health` prints them; an agent that
 * published the game reads them the way it reads a failed check.
 *
 * The check measures a game on one machine with no GPU. These are the
 * visitors' machines, which is where "it ran fine for me" stops being
 * the answer.
 */
import type { DeviceHealth, ReleaseHealth } from "./gameHealthSummary";

/** The budgets. The first frame's is the check's own (FIRST_FRAME_SLOW). */
export const FIELD_BUDGETS = {
    /** Milliseconds to the first frame, for 19 visits in 20. */
    firstFrameP95Ms: 5000,
    /** A usual frame: 30 a second is the floor a game should keep. */
    frameMedianMs: 33.4,
    /** The slow frames of a usual stretch: beyond this they are hitches. */
    frameP95Ms: 50,
    /** Share of visits that never reached a first frame. */
    loadFailureShare: 0.02,
    /** Fewer visits than this and the numbers are a hint, not a verdict. */
    fewVisits: 20,
} as const;

export interface HealthFinding {
    code:
        | "FIELD_NO_VISITS"
        | "FIELD_FEW_VISITS"
        | "FIELD_FIRST_FRAME_SLOW"
        | "FIELD_FRAMES_SLOW"
        | "FIELD_FRAMES_HITCH"
        | "FIELD_LOAD_FAILED"
        | "FIELD_ERROR";
    /** A device the finding is about, when it is about one. */
    device?: string;
    /** A sentence for whoever fixes it: what was seen, and what to do. */
    text: string;
}

const fps = (ms: number) => Math.round(1000 / ms);
const percent = (share: number) => `${Math.round(share * 1000) / 10}%`;

function deviceFindings(device: string, seen: DeviceHealth): HealthFinding[] {
    const found: HealthFinding[] = [];
    const on = `on ${device === "desktop" ? "desktops" : device + "s"}`;
    if (
        seen.firstFrameMs &&
        seen.firstFrameMs.p95 > FIELD_BUDGETS.firstFrameP95Ms
    )
        found.push({
            code: "FIELD_FIRST_FRAME_SLOW",
            device,
            text: `The first frame takes ${seen.firstFrameMs.p95} ms ${on} for the slowest visits (median ${seen.firstFrameMs.median} ms; the budget is ${FIELD_BUDGETS.firstFrameP95Ms}). Draw something sooner: load less before the first frame, and the rest after it.`,
        });
    if (seen.frameMs && seen.frameMs.median > FIELD_BUDGETS.frameMedianMs)
        found.push({
            code: "FIELD_FRAMES_SLOW",
            device,
            text: `A usual frame takes ${
                seen.frameMs.median
            } ms ${on}: about ${fps(
                seen.frameMs.median
            )} frames a second, under the 30 a game should keep. Draw less there: fewer draw calls, smaller textures, a lower pixel ratio, cheaper shadows.`,
        });
    else if (seen.frameMs && seen.frameMs.p95 > FIELD_BUDGETS.frameP95Ms)
        found.push({
            code: "FIELD_FRAMES_HITCH",
            device,
            text: `Frames hitch ${on}: the slow ones take ${seen.frameMs.p95} ms against a usual ${seen.frameMs.median} ms. Something runs in bursts: allocation in the update, a shader or texture first used mid-play, work done every few frames.`,
        });
    return found;
}

/** What one release's field health asks for; nothing when it asks nothing. */
export function healthFindings(release: ReleaseHealth): HealthFinding[] {
    const tried = release.visits + release.loadFailures;
    if (!tried && !release.failures.length)
        return [
            {
                code: "FIELD_NO_VISITS",
                text: "No visits have reported yet. Field health comes from real visits, a sample of them for frame times: look again once people have played.",
            },
        ];
    const found: HealthFinding[] = [];
    if (release.visits < FIELD_BUDGETS.fewVisits)
        found.push({
            code: "FIELD_FEW_VISITS",
            text: `These numbers are from ${release.visits} visit${
                release.visits === 1 ? "" : "s"
            }: a hint, not a verdict.`,
        });
    if (tried && release.loadFailures / tried > FIELD_BUDGETS.loadFailureShare)
        found.push({
            code: "FIELD_LOAD_FAILED",
            text: `${release.loadFailures} of ${tried} visits (${percent(
                release.loadFailures / tried
            )}) never reached a first frame. The errors below say why when the game said so; a timeout with no error is a load that is too heavy or waits on something that does not come.`,
        });
    // Worst first: the slowest device's findings lead.
    for (const [device, seen] of Object.entries(release.byDevice).sort(
        (a, b) => (b[1].frameMs?.median ?? 0) - (a[1].frameMs?.median ?? 0)
    ))
        found.push(...deviceFindings(device, seen));
    for (const failure of release.failures)
        found.push({
            code: "FIELD_ERROR",
            text: `${failure.count}× ${failure.kind}: ${failure.message}${
                failure.where ? ` (${failure.where})` : ""
            }`,
        });
    return found;
}
