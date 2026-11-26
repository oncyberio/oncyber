import { api } from "@utils/rpc/server";
import { begin } from "./begin";
import { finish } from "./finish";
import { link } from "./link";
import { mine } from "./mine";
import { unpublish } from "./unpublish";

/**
 * Publishing a game from outside the repository
 * (docs/games/publishing.md). Called by the `oncyber` command with a
 * session token, never by a game's frame. Every procedure needs a
 * signed-in account that `GAMES_PUBLISHING` lets publish.
 */
const GamePublishService = {
    cors: false,
    auth: true,

    begin,
    finish,
    link,
    mine,
    unpublish,
};

export default api(GamePublishService);
