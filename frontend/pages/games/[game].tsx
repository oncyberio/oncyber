import type { GetServerSideProps } from "next";
import GameRoute from "@features/games/GameRoute";
import { loadGameRoute } from "@features/games/gameRouteServer";

/**
 * /games/<id>: a catalogued game, or one published from outside the
 * repository (docs/games/publishing.md). Hidden until games launch. A game
 * with a slug is also at /<slug> (pages/[slug].tsx), from the same
 * component and the same props.
 */
export default GameRoute;

export const getServerSideProps: GetServerSideProps = async ({
    params,
    query,
}) => {
    const route = await loadGameRoute(params?.game, {
        draft: "draft" in query,
    });
    return route
        ? { props: { ...route, lobbyWorld: true } }
        : { notFound: true };
};
