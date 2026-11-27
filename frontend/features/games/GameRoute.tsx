import Head from "next/head";
import GamePage from "./GamePage";
import GameDeviceGate from "./interface/GameDeviceGate";
import GameKillSwitchGate from "./health/GameKillSwitchGate";
import type { GameRouteProps } from "./gameRoute";

/**
 * A game's page, wherever the site serves it: /games/<id>
 * (pages/games/[game].tsx) and, for a game with a slug, /<slug>
 * (pages/[slug].tsx). One component and one set of props (gameRoute.ts,
 * built on the server by gameRouteServer.ts), so the two addresses cannot
 * come apart. Both name the same canonical address.
 */
export default function GameRoute({
    game,
    killSwitch,
    frame,
    canonical,
}: GameRouteProps) {
    return (
        <>
            <Head>
                <title>{`${game.title} · Oncyber`}</title>
                <meta name="robots" content="noindex,nofollow" />
                <link rel="canonical" href={canonical} />
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
