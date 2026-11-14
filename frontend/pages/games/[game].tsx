import Head from "next/head";
import type { GetServerSideProps } from "next";
import GamePage from "@features/games/GamePage";
import {
    findGame,
    gamesPreviewEnabled,
    type GameEntry,
} from "@features/games/catalog";

/** /games/<id>: a catalogued game, hidden until games launch. */
export default function GameRoute({ game }: { game: GameEntry }) {
    return (
        <>
            <Head>
                <title>{`${game.title} · Oncyber`}</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>
            <GamePage game={game} />
        </>
    );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
    const game = findGame(params?.game);
    if (!game || !gamesPreviewEnabled()) return { notFound: true };
    return { props: { game, lobbyWorld: true } };
};
