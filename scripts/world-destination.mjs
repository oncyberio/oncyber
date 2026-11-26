/**
 * A destination's settings from the terminal: the `destination` commands of
 * world-cli.mjs. A destination is the world a space is built on; what is
 * set here holds for every space built on it.
 *
 *   node scripts/world-cli.mjs destination avatar-height <slug>
 *   node scripts/world-cli.mjs destination avatar-height <slug> <height>
 *   node scripts/world-cli.mjs destination avatar-height <slug> unset
 *
 * `avatar-height` is how tall avatars stand there, in the world's own
 * units. With nothing after the slug it says what the world has now. A
 * world is right when a person fits its doors: an avatar about three
 * quarters of the height of a typical door
 * (docs/destinations-firestore-schema.md has Starry Night as a worked case). The destination's owner or
 * a site admin may set it.
 */

/** The shortest and tallest an avatar can stand (frontend `avatarHeight`). */
export const HEIGHTS = { min: 1, max: 4.5 };

/** Where an avatar's eyes sit, as a share of its height. */
const EYE_LEVEL = 0.93;

/** How tall avatars stand in a destination as it is saved, and why. */
export function standingHeight(params = {}) {
    const size = Number(params.avatarSize);
    if (size > 0)
        return {
            height: round(HEIGHTS.min + (HEIGHTS.max - HEIGHTS.min) * size),
            from: "its avatar height setting",
        };
    const eye = Number(params.user_height);
    if (eye > 0)
        return {
            height: round(
                Math.min(HEIGHTS.max, Math.max(HEIGHTS.min, eye / EYE_LEVEL))
            ),
            from: `its eye height (${eye}); no avatar height is set`,
        };
    return { height: null, from: "nothing: visitors keep their own size" };
}

const round = (value) => Math.round(value * 100) / 100;

/** What was asked for after the slug: nothing, a height, or `unset`. */
export function readHeight(given) {
    if (given === undefined) return { read: true };
    if (given === "unset") return { height: null };
    const height = Number(given);
    if (
        !Number.isFinite(height) ||
        height < HEIGHTS.min ||
        height > HEIGHTS.max
    )
        return {
            error: `An avatar height is from ${HEIGHTS.min} to ${HEIGHTS.max} of the world's units, or "unset".`,
        };
    return { height };
}

/**
 * Runs a `destination` command. `rpc(method, params)` calls a procedure of
 * the `destinations` service as the signed-in account.
 */
export async function destinationCommand(args, rpc, io = {}) {
    const say = io.log || console.log;
    const [command, slug, given] = args;
    if (command !== "avatar-height" || !slug)
        throw new Error(
            "Usage: destination avatar-height <slug> [height|unset]"
        );
    const asked = readHeight(given);
    if (asked.error) throw new Error(asked.error);

    const destination = await rpc("getDestinationBySlug", { slug });
    if (!destination?._id)
        throw new Error(`No destination is called "${slug}".`);
    const now = standingHeight(destination.params);
    if (asked.read) {
        say(
            now.height === null
                ? `${slug}: avatars keep their own size (nothing is set).`
                : `${slug}: avatars stand ${now.height} units tall, from ${now.from}.`
        );
        return;
    }
    const answer = await rpc("setAvatarHeight", {
        id: destination._id,
        height: asked.height,
    });
    if (!answer?.success) throw new Error("The height was not saved.");
    say(
        answer.height === null
            ? `${slug}: the avatar height setting is gone (it was ${
                  now.height ?? "unset"
              }).`
            : `${slug}: avatars stand ${
                  answer.height
              } units tall now (they stood ${
                  now.height ?? "at their own size"
              }).`
    );
    say("Every space built on this destination follows, on its next load.");
}
