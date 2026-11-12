import { useEffect, useRef, useState } from "react";
import type { CapturedAvatarFrame } from "./avatarFeedback";
export type AvatarFeedbackCapture = {
    schemaVersion: 1;
    clickedAt: string;
    avatar: { id: string; avatarUrl?: string };
    frames: CapturedAvatarFrame[];
    context: {
        seed: number;
        profile: string;
        simulationMs: number;
        [key: string]: unknown;
    };
    rendering: unknown;
};
export default function AvatarFeedbackPanel({
    capture,
}: {
    capture: AvatarFeedbackCapture | null;
}) {
    const [saved, setSaved] = useState<any[]>([]);
    const [reportId, setReportId] = useState<string>();
    const [notes, setNotes] = useState("");
    const [category, setCategory] = useState("Unspecified");
    const [status, setStatus] = useState("");
    const [trace, setTrace] = useState<{ id: string; json: string } | null>(
        null
    );
    const [exportStatus, setExportStatus] = useState("");
    const generation = useRef(0);
    const lastCapture = useRef<AvatarFeedbackCapture | null>();
    const exportTrace = async (id: string, download = false) => {
        setExportStatus("Loading trace…");
        try {
            const response = await fetch(`/api/dev/lobby-feedback?id=${id}`);
            if (!response.ok) throw new Error("Trace unavailable");
            const json = JSON.stringify(await response.json(), null, 2);
            setTrace({ id, json });
            if (download) {
                const url = URL.createObjectURL(
                    new Blob([json + "\n"], { type: "application/json" })
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = `lobby-avatar-${id}.json`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                // The browser may consume the blob asynchronously after the click.
                window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            }
            setExportStatus(
                download
                    ? "Download requested. The full trace is also available below."
                    : "Trace loaded. Notes are already saved locally; no download is needed for review."
            );
        } catch {
            setExportStatus(
                "Could not load this trace. Your saved notes have not been changed."
            );
        }
    };
    useEffect(() => {
        fetch("/api/dev/lobby-feedback")
            .then((r) => (r.ok ? r.json() : []))
            .then((loaded) =>
                setSaved((previous) =>
                    [
                        ...previous,
                        ...loaded.filter(
                            (item: any) =>
                                !previous.some(
                                    (current) => current.id === item.id
                                )
                        ),
                    ].slice(0, 30)
                )
            )
            .catch(() => {});
    }, []);
    const save = async (
        record: AvatarFeedbackCapture,
        text: string,
        kind: string,
        id?: string,
        current = generation.current
    ) => {
        setStatus("Saving…");
        try {
            const response = await fetch("/api/dev/lobby-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...record,
                    id,
                    notes: text,
                    category: kind,
                }),
            });
            if (!response.ok) throw new Error("save failed");
            const result = await response.json();
            setSaved((previous) =>
                [
                    {
                        ...result,
                        avatar: record.avatar,
                        notes: text,
                        category: kind,
                        simulationMs: record.context.simulationMs,
                    },
                    ...previous.filter((item) => item.id !== result.id),
                ].slice(0, 30)
            );
            if (current === generation.current) {
                setReportId(result.id);
                setStatus("Saved locally — ready for review");
            }
        } catch {
            if (current === generation.current)
                setStatus(
                    "Could not save. Your trace is still here; retry below."
                );
        }
    };
    useEffect(() => {
        // Strict Mode and hot reload can replay effects for the same capture.
        // Keep the original report id and any notes instead of creating a blank copy.
        if (capture === lastCapture.current) return;
        lastCapture.current = capture;
        const current = ++generation.current;
        setNotes("");
        setCategory("Unspecified");
        setReportId(undefined);
        if (capture) {
            if (!capture.frames.length)
                setStatus(
                    "Avatar is still loading. Click it again once it is moving."
                );
            else void save(capture, "", "Unspecified", undefined, current);
        }
    }, [capture]);
    const frames = capture?.frames || [];
    const duration =
        frames.length > 1
            ? (frames.at(-1).timeMs - frames[0].timeMs) / 1000
            : 0;
    const speeds = frames.map((frame) => frame.motion.speed);
    const maximum = Math.max(6, ...speeds);
    const points = speeds
        .map(
            (speed, i) =>
                `${(i / Math.max(1, speeds.length - 1)) * 280},${
                    48 - (speed / maximum) * 44
                }`
        )
        .join(" ");
    return (
        <section className="feedback" aria-label="Avatar feedback">
            <h2>Spot a glitch? Click the avatar.</h2>
            <p>
                Click your avatar or anyone in the crowd. The preceding four
                seconds of motion are saved automatically. Dragging still moves
                the camera.
            </p>
            {capture && (
                <div data-testid="avatar-feedback-capture">
                    <strong>
                        {capture.avatar.id === "self"
                            ? "Your avatar"
                            : `Avatar ${capture.avatar.id}`}{" "}
                        · {(capture.context.simulationMs / 1000).toFixed(1)}s
                    </strong>
                    <p>
                        {duration.toFixed(1)} seconds · {frames.length} frames ·{" "}
                        {capture.context.profile}
                    </p>
                    {frames.length > 1 && (
                        <svg
                            viewBox="0 0 280 52"
                            role="img"
                            aria-label="Captured avatar speed over time"
                        >
                            <polyline
                                points={points}
                                fill="none"
                                stroke="#278795"
                                strokeWidth="1.5"
                            />
                        </svg>
                    )}
                    <label>
                        What looked wrong?
                        <select
                            value={category}
                            onChange={(event) =>
                                setCategory(event.target.value)
                            }
                        >
                            {[
                                "Unspecified",
                                "Foot sliding",
                                "Jerky movement",
                                "Wrong pose",
                                "Other",
                            ].map((value) => (
                                <option key={value}>{value}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Optional note
                        <textarea
                            value={notes}
                            maxLength={2000}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="For example: rocks back and forth after stopping"
                        />
                    </label>
                    <button
                        disabled={!frames.length || status === "Saving…"}
                        onClick={() => save(capture, notes, category, reportId)}
                    >
                        {reportId ? "Save note" : "Retry save"}
                    </button>
                    {reportId && (
                        <div className="trace-actions">
                            <button onClick={() => exportTrace(reportId)}>
                                View trace
                            </button>
                            <button onClick={() => exportTrace(reportId, true)}>
                                Download trace
                            </button>
                        </div>
                    )}
                    <p role="status">{status}</p>
                </div>
            )}
            {!!saved.length && (
                <details>
                    <summary>Saved avatar flags ({saved.length})</summary>
                    <ul>
                        {saved.map((item) => (
                            <li key={item.id}>
                                <button
                                    className="trace-link"
                                    onClick={() => exportTrace(item.id)}
                                >
                                    {item.avatar.id === "self"
                                        ? "Your avatar"
                                        : `Avatar ${item.avatar.id}`}{" "}
                                    · {(item.simulationMs / 1000).toFixed(1)}s ·{" "}
                                    {item.category}
                                </button>
                                {item.notes && <span>{item.notes}</span>}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            {exportStatus && <p role="status">{exportStatus}</p>}
            {trace && (
                <div className="trace-view">
                    <label>
                        Trace JSON
                        <textarea
                            readOnly
                            value={trace.json}
                            onFocus={(event) => event.target.select()}
                        />
                    </label>
                    <div className="trace-actions">
                        <button onClick={() => exportTrace(trace.id, true)}>
                            Download viewed trace
                        </button>
                        <button onClick={() => setTrace(null)}>
                            Close trace
                        </button>
                    </div>
                </div>
            )}
            <style jsx>{`
                .feedback {
                    border-top: 1px solid #dde1e4;
                    padding-top: 16px;
                    margin: 20px 0;
                }
                h2 {
                    font-size: 14px;
                    font-weight: 500;
                    margin: 0 0 8px;
                }
                p,
                label,
                strong,
                summary,
                a,
                li {
                    font-size: 11px;
                    line-height: 1.5;
                }
                p {
                    color: #687178;
                }
                strong {
                    display: block;
                }
                svg {
                    width: 100%;
                    height: 52px;
                    background: #f4f8f9;
                    border-radius: 7px;
                }
                label {
                    display: block;
                    margin: 10px 0;
                    color: #687178;
                }
                select,
                textarea {
                    display: block;
                    width: 100%;
                    box-sizing: border-box;
                    margin-top: 5px;
                    padding: 8px;
                    border: 1px solid #dde1e4;
                    border-radius: 8px;
                    background: #fff;
                    font: inherit;
                    color: #151718;
                }
                textarea {
                    min-height: 58px;
                    resize: vertical;
                }
                button {
                    border: 1px solid #dde1e4;
                    border-radius: 20px;
                    padding: 8px 12px;
                    background: #192023;
                    color: white;
                    cursor: pointer;
                    font-size: 11px;
                }
                .trace-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin: 8px 0;
                }
                .trace-link {
                    background: none;
                    color: #246b76;
                    border: 0;
                    border-radius: 0;
                    padding: 8px 0;
                    text-align: left;
                }
                .trace-view textarea {
                    height: 150px;
                    font-family: monospace;
                    font-size: 10px;
                }
                button:disabled {
                    opacity: 0.5;
                }
                a {
                    display: block;
                    color: #246b76;
                    margin: 8px 0;
                }
                summary {
                    cursor: pointer;
                }
                ul {
                    padding-left: 16px;
                }
                span {
                    display: block;
                    font-size: 10px;
                    color: #687178;
                }
            `}</style>
        </section>
    );
}
