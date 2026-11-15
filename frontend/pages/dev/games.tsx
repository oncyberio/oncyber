import Head from "next/head";
import { GAMES } from "@features/games/catalog";
import GameFieldHealth from "@features/games/GameFieldHealth";
import { gamePause, type GamePause } from "@features/games/gameDisabled";
import {
    readFieldHealth,
    type FieldHealth,
} from "@features/games/gameHealthSummary";

type Finding = { code: string; message: string };
type Frames = { medianMs: number; p95Ms: number; worstMs: number };
type GameStatus = {
    id: string;
    title: string;
    release: { release: string; publishedAt: string; files: unknown[] } | null;
    check: {
        status: string;
        checkedAt: string;
        findings: Finding[];
        consoleErrors: string[];
        files: { count: number; bytes: number };
        run: { backend: string; bootMs: number; frames: Frames } | null;
    } | null;
    health: FieldHealth | null;
    pause: GamePause;
};

const mib = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MiB`;

/**
 * Development page for games: what each catalogued game last published and
 * how its last check went. Publishing itself is `pnpm games:publish <id>`;
 * see docs/games.md.
 */
export default function GamesDev({ games }: { games: GameStatus[] }) {
    return (
        <main
            style={{
                minHeight: "100vh",
                background: "#0b0d12",
                color: "#f2f3f1",
                padding: "64px 24px",
                font: "15px/1.5 system-ui, sans-serif",
            }}
        >
            <Head>
                <title>Games · Oncyber dev</title>
            </Head>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
                <h1 style={{ fontWeight: 500, fontSize: 32 }}>Games</h1>
                <p style={{ color: "#a8acaf" }}>
                    Hidden at launch. Each game is a static bundle in{" "}
                    <code>public/games/&lt;id&gt;</code>. Run{" "}
                    <code>pnpm games:publish &lt;id&gt;</code> to build it,
                    check it in a browser and write a fixed release; a failed
                    check publishes nothing.
                </p>
                {games.map((game) => (
                    <section
                        key={game.id}
                        style={{
                            marginTop: 28,
                            padding: 24,
                            borderRadius: 18,
                            background: "#15181f",
                            border: "1px solid #ffffff18",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: 16,
                            }}
                        >
                            <h2 style={{ margin: 0, fontWeight: 500 }}>
                                {game.title}
                            </h2>
                            <a
                                href={`/games/${game.id}`}
                                style={{ color: "#ffd23f" }}
                            >
                                Play →
                            </a>
                        </div>
                        <p style={{ margin: "8px 0", color: "#a8acaf" }}>
                            {game.release
                                ? `Release ${game.release.release} · ${
                                      game.release.files.length
                                  } files · published ${new Date(
                                      game.release.publishedAt
                                  ).toLocaleString()}`
                                : "Not published yet."}
                        </p>
                        {game.check ? (
                            <>
                                <p style={{ margin: "8px 0" }}>
                                    Last check:{" "}
                                    <strong
                                        style={{
                                            color:
                                                game.check.status === "passed"
                                                    ? "#8be28b"
                                                    : "#ffa59d",
                                        }}
                                    >
                                        {game.check.status}
                                    </strong>{" "}
                                    ·{" "}
                                    {new Date(
                                        game.check.checkedAt
                                    ).toLocaleString()}{" "}
                                    · {mib(game.check.files.bytes)} in{" "}
                                    {game.check.files.count} files
                                </p>
                                {game.check.run && (
                                    <p
                                        style={{
                                            margin: "8px 0",
                                            color: "#a8acaf",
                                        }}
                                    >
                                        {game.check.run.frames
                                            ? `${game.check.run.backend} · ready in ${game.check.run.bootMs} ms · frames median ${game.check.run.frames.medianMs} ms, p95 ${game.check.run.frames.p95Ms} ms, worst ${game.check.run.frames.worstMs} ms`
                                            : `Boot check only (no lifecycle yet) · ready in ${game.check.run.bootMs} ms`}
                                    </p>
                                )}
                                {game.check.findings.map((finding, i) => (
                                    <p
                                        key={i}
                                        style={{
                                            color: "#ffa59d",
                                            margin: "6px 0",
                                        }}
                                    >
                                        <code>{finding.code}</code>{" "}
                                        {finding.message}
                                    </p>
                                ))}
                                {game.check.consoleErrors.length > 0 && (
                                    <details>
                                        <summary
                                            style={{
                                                cursor: "pointer",
                                                color: "#a8acaf",
                                            }}
                                        >
                                            {game.check.consoleErrors.length}{" "}
                                            console error(s) (not blocking)
                                        </summary>
                                        <pre
                                            style={{
                                                whiteSpace: "pre-wrap",
                                                fontSize: 12,
                                            }}
                                        >
                                            {game.check.consoleErrors.join(
                                                "\n"
                                            )}
                                        </pre>
                                    </details>
                                )}
                            </>
                        ) : (
                            <p style={{ color: "#a8acaf" }}>
                                Never checked. Run{" "}
                                <code>pnpm games:check {game.id}</code>.
                            </p>
                        )}
                        <GameFieldHealth
                            health={game.health}
                            current={game.release?.release ?? null}
                            pause={game.pause}
                        />
                    </section>
                ))}
            </div>
        </main>
    );
}

export async function getServerSideProps() {
    if (process.env.NODE_ENV !== "development") return { notFound: true };
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const read = async (id: string, file: string) => {
        try {
            return JSON.parse(
                await readFile(
                    join(process.cwd(), "public/games", id, file),
                    "utf8"
                )
            );
        } catch {
            return null;
        }
    };
    const health = await readFieldHealth(Object.keys(GAMES));
    const games: GameStatus[] = await Promise.all(
        Object.values(GAMES).map(async (game) => ({
            id: game.id,
            title: game.title,
            release: await read(game.id, "release.json"),
            check: await read(game.id, "check.json"),
            health: health[game.id] ?? null,
            pause: gamePause(game.id),
        }))
    );
    return { props: { games } };
}
