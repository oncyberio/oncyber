import Head from "next/head";
import type { GetServerSideProps } from "next";
import GamePage from "@features/games/GamePage";
import GameDeviceGate from "@features/games/GameDeviceGate";
import GameKillSwitchGate from "@features/games/GameKillSwitchGate";
import {
    gameKillSwitch,
    killSwitchForRelease,
    type GameKillSwitch,
} from "@features/games/gameDisabled";
import {
    findGame,
    gamesPreviewEnabled,
    type GameEntry,
} from "@features/games/catalog";
import type { GameFrame } from "@features/games/gameRelease";
import { loadGameFrame } from "@features/games/gameReleaseServer";

/**
 * /games/<id>: a catalogued game, or one published from outside the
 * repository (docs/games/publishing.md). Hidden until games launch.
 */
export default function GameRoute({
    game,
    killSwitch,
    frame,
}: {
    game: GameEntry;
    /** `GAMES_DISABLED` for this game and release (gameDisabled.ts). */
    killSwitch: GameKillSwitch;
    frame: GameFrame;
}) {
    return (
        <>
            <Head>
                <title>{`${game.title} · Oncyber`}</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>
            <GameDeviceGate game={game}>
                <GameKillSwitchGate
                    game={game.id}
                    title={game.title}
                    killSwitch={killSwitch}
                >
                    <GamePage game={game} frame={frame} />
                </GameKillSwitchGate>
            </GameDeviceGate>
        </>
    );
}

export const getServerSideProps: GetServerSideProps = async ({
    params,
    query,
}) => {
    if (!gamesPreviewEnabled()) return { notFound: true };
    const game = findGame(params?.game);
    if (!game) {
        // Not in the catalog: a game the registry holds, if it is
        // published. It runs in the same page, behind the same gates.
        const { loadRegisteredGame } = await import(
            "@features/games/publishedGamesServer"
        );
        const registered = await loadRegisteredGame(params?.game);
        if (!registered) return { notFound: true };
        const killSwitch = killSwitchForRelease(
            gameKillSwitch(registered.game.id),
            registered.frame.release
        );
        return { props: { ...registered, killSwitch, lobbyWorld: true } };
    }
    // A hosted release when a person pointed the game at one, else the
    // committed build (docs/games/releases.md).
    const frame = await loadGameFrame(game.id, { draft: "draft" in query });
    // The kill switch stops the release this visit would load: a hosted
    // one is decided here, by the pointer's id.
    const killSwitch = killSwitchForRelease(
        gameKillSwitch(game.id),
        frame.release
    );
    return { props: { game, killSwitch, frame, lobbyWorld: true } };
};
