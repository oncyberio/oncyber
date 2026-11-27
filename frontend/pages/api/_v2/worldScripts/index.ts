/**
 * World scripts: AI-written scripts that run on top of a space, sandboxed.
 * See docs/world-scripts.md. Everything here refuses unless
 * NEXT_PUBLIC_WORLD_SCRIPTS is on.
 */
import { api } from "@utils/rpc/server";
import { access, generate } from "./generate";
import { save } from "./save";
import { current, get, reference } from "./read";
import { grant, people, revoke } from "./people";

const WorldScriptsService = {
    cors: true,
    auth: true,
    access,
    generate,
    save,
    get,
    reference,
    current,
    people,
    grant,
    revoke,
};

export default api(WorldScriptsService);

// A model writing a whole game can take most of a minute.
export const config = { maxDuration: 60 };
