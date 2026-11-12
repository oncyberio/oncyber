import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs, existsSync } from "fs";
import path from "path";
import { randomUUID, createHash } from "crypto";
export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };
const validId = (id: unknown): id is string =>
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        id
    );
export function validFeedback(body: any) {
    return (
        body?.schemaVersion === 1 &&
        typeof body.avatar?.id === "string" &&
        body.avatar.id.length <= 80 &&
        typeof body.notes === "string" &&
        body.notes.length <= 2000 &&
        [
            "Unspecified",
            "Foot sliding",
            "Jerky movement",
            "Wrong pose",
            "Other",
        ].includes(body.category) &&
        Number.isFinite(body.context?.seed) &&
        Number.isFinite(body.context?.simulationMs) &&
        [
            "clean",
            "regional",
            "mobile",
            "distant",
            "serverstall",
            "outage",
        ].includes(body.context?.profile) &&
        Array.isArray(body.frames) &&
        body.frames.length > 0 &&
        body.frames.length <= 300 &&
        body.frames.every(
            (frame: any) =>
                [
                    "timeMs",
                    "simulationMs",
                    "dt",
                    "x",
                    "y",
                    "z",
                    "rotation",
                ].every((key) => Number.isFinite(frame?.[key])) &&
                frame.dt >= 0 &&
                frame.dt <= 0.1 &&
                Number.isFinite(frame.motion?.speed)
        ) &&
        Buffer.byteLength(JSON.stringify(body)) <= 200000
    );
}
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (process.env.NODE_ENV !== "development") return res.status(404).end();
    const host = req.headers.host || "";
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))
        return res.status(403).json({ error: "Local development only" });
    if (
        req.headers.origin &&
        !["http://" + host, "https://" + host].includes(req.headers.origin)
    )
        return res.status(403).json({ error: "Same-origin requests only" });
    const root = [process.cwd(), path.dirname(process.cwd())].find(
        (candidate) =>
            existsSync(path.join(candidate, "frontend/features/lobby"))
    );
    if (!root)
        return res.status(503).json({ error: "Project directory unavailable" });
    const directory = path.join(root, "docs/benchmarks/lobby-feedback");
    res.setHeader("Cache-Control", "no-store");
    try {
        if (req.method === "GET") {
            if (req.query.id !== undefined) {
                if (!validId(req.query.id))
                    return res.status(400).json({ error: "Invalid report id" });
                const report = JSON.parse(
                    await fs.readFile(
                        path.join(directory, req.query.id + ".json"),
                        "utf8"
                    )
                );
                if (req.query.download)
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="lobby-avatar-${report.id}.json"`
                    );
                return res.status(200).json(report);
            }
            const files = await fs
                .readdir(directory)
                .catch(() => [] as string[]);
            const reports = await Promise.all(
                files
                    .filter(
                        (file) =>
                            validId(file.slice(0, -5)) && file.endsWith(".json")
                    )
                    .map(async (file) => {
                        const report = JSON.parse(
                            await fs.readFile(
                                path.join(directory, file),
                                "utf8"
                            )
                        );
                        return {
                            id: report.id,
                            avatar: report.avatar,
                            savedAt: report.savedAt,
                            category: report.category,
                            notes: report.notes,
                            simulationMs: report.context.simulationMs,
                        };
                    })
            );
            return res
                .status(200)
                .json(
                    reports
                        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
                        .slice(0, 30)
                );
        }
        if (req.method !== "POST") {
            res.setHeader("Allow", "GET, POST");
            return res.status(405).end();
        }
        if (
            !validFeedback(req.body) ||
            (req.body.id !== undefined && !validId(req.body.id))
        )
            return res
                .status(400)
                .json({ error: "Invalid or oversized avatar trace" });
        const id = req.body.id || randomUUID();
        const existing = req.body.id
            ? JSON.parse(
                  await fs.readFile(path.join(directory, id + ".json"), "utf8")
              )
            : undefined;
        const sourcePaths = [
            "frontend/features/lobby/createLobbyScene.tsx",
            "frontend/features/lobby/LobbyMotionStore.ts",
            "frontend/features/lobby/locomotion.ts",
            "frontend/features/lobby/motionTransitions.ts",
            "frontend/features/lobby/optionalMotionPack.ts",
        ];
        const hashes = await Promise.all(
            sourcePaths.map(async (file) => [
                file,
                createHash("sha256")
                    .update(await fs.readFile(path.join(root, file), "utf8"))
                    .digest("hex"),
            ])
        );
        const report = {
            ...req.body,
            id,
            savedAt: new Date().toISOString(),
            // Updating a note must not relabel the original capture as newer code.
            sourceHashes: existing?.sourceHashes ?? Object.fromEntries(hashes),
        };
        await fs.mkdir(directory, { recursive: true });
        const target = path.join(directory, id + ".json");
        const temporary = target + "." + randomUUID() + ".tmp";
        await fs.writeFile(temporary, JSON.stringify(report, null, 2) + "\n");
        await fs.rename(temporary, target);
        return res.status(200).json({ id, savedAt: report.savedAt });
    } catch (error) {
        return res
            .status((error as any)?.code === "ENOENT" ? 404 : 500)
            .json({ error: "Could not read or save the local report" });
    }
}
