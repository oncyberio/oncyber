import { test } from "node:test";
import assert from "node:assert/strict";
import { healthLines, needsWork } from "../lib/health.mjs";

const budgets = {
    firstFrameP95Ms: 5000,
    frameMedianMs: 33.4,
    frameP95Ms: 50,
    loadFailureShare: 0.02,
    fewVisits: 20,
};
const release = (patch = {}) => ({
    release: "r2",
    visits: 120,
    devices: { desktop: 80, phone: 40 },
    byDevice: {
        desktop: {
            visits: 80,
            firstFrameMs: { median: 900, p95: 2100 },
            frameMs: { median: 16.7, p95: 21, windows: 40 },
        },
        phone: {
            visits: 40,
            firstFrameMs: { median: 2400, p95: 6100 },
            frameMs: { median: 41, p95: 72, windows: 12 },
        },
    },
    loadFailures: 3,
    findings: [
        {
            code: "FIELD_FRAMES_SLOW",
            device: "phone",
            text: "A usual frame takes 41 ms on phones.",
        },
    ],
    ...patch,
});
const report = (patch = {}) => ({
    id: "sky-run",
    source: "posthog",
    budgets,
    current: "r2",
    releases: [release()],
    ...patch,
});

test("says where the numbers are from, each device's own, and what to fix", () => {
    const lines = healthLines(report(), "https://oncyber.io");
    assert.match(
        lines[0],
        /sky-run on https:\/\/oncyber\.io: field health, from real visits of the last seven days/
    );
    assert.match(lines[1], /budgets: first frame 5000 ms/);
    const text = lines.join("\n");
    assert.match(
        text,
        /release r2 \(on show\): 120 visits \(desktop 80, phone 40\)/
    );
    assert.match(
        text,
        /phone: first frame 2400 ms usual, 6100 ms slowest; frames 41 ms usual \(24 fps\), 72 ms slow/
    );
    assert.match(text, /never reached a first frame: 3/);
    assert.match(
        text,
        /FIELD_FRAMES_SLOW: A usual frame takes 41 ms on phones\./
    );
});

test("a game within its budgets says so; an older release is not called on show", () => {
    const lines = healthLines(
        report({
            releases: [
                release({ findings: [] }),
                release({ release: "r1", findings: [] }),
            ],
        }),
        "https://oncyber.io"
    ).join("\n");
    assert.match(lines, /within its budgets: nothing to fix/);
    assert.match(lines, /release r1: 120 visits/);
});

test("no visits yet, a development server, and a site that cannot read visits back", () => {
    const empty = healthLines(
        report({
            source: "local",
            releases: [],
            error: "This site is not set up to read visits back.",
        }),
        "http://localhost:13000"
    ).join("\n");
    assert.match(empty, /this development server's own visits/);
    assert.match(empty, /note: This site is not set up to read visits back\./);
    assert.match(empty, /No visits have reported yet/);
});

test("only the release on show, and only something to fix, asks for work", () => {
    assert.equal(needsWork(report()), true);
    assert.equal(
        needsWork(
            report({
                releases: [
                    release({
                        findings: [{ code: "FIELD_FEW_VISITS", text: "…" }],
                    }),
                    release({ release: "r1" }),
                ],
            })
        ),
        false
    );
    assert.equal(needsWork(report({ releases: [] })), false);
});
