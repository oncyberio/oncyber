/**
 * What a game reports about avatars through `inspect()`, and the rule
 * `pnpm games:check` holds it to. Plain data: usable by a game that draws
 * avatars with its own code, and by the check script in Node.
 */

/**
 * @typedef {object} AvatarFacts
 * @property {"vrm" | "stand-in" | "none"} avatarSelf What the visitor's body is right now.
 * @property {boolean} avatarSelfInFrame The visitor's body was drawn in the last frame, inside the camera's view.
 * @property {number} avatarOthers Other players the page announced.
 * @property {number} avatarOthersDrawn Of those, how many were drawn in the last frame.
 * @property {number} avatarOthersVrm Of those drawn, how many as their own Oncyber avatar (not a stand-in).
 * @property {"none" | "crouched" | "rising" | "standing"} avatarArrival
 * @property {boolean} avatarFacingCamera
 * @property {boolean} avatarHandsEmpty
 * @property {number} avatarTalking Players showing the talking indicator.
 * @property {string} avatarEmote The visitor's current emote, or "".
 */

/** @type {AvatarFacts} */
export const NO_AVATARS = {
    avatarSelf: "none",
    avatarSelfInFrame: false,
    avatarOthers: 0,
    avatarOthersDrawn: 0,
    avatarOthersVrm: 0,
    avatarArrival: "none",
    avatarFacingCamera: false,
    avatarHandsEmpty: false,
    avatarTalking: 0,
    avatarEmote: "",
};

/**
 * The `avatars` block of game.json, with its defaults filled in. Other
 * people appear as their Oncyber avatar, and the visitor arrives in the
 * arrival pose, unless the game says why not:
 *
 *   "avatars": { "others": "other", "why": "<a sentence>" }
 *   "avatars": { "arrival": "none", "arrivalWhy": "<a sentence>" }
 *
 * @returns {{ others: "avatar" | "other", why: string, arrival: "pose" | "none", arrivalWhy: string, problems: string[] }}
 */
export function readAvatarRule(manifest) {
    const block = manifest?.avatars ?? {};
    const problems = [];
    const sentence = (value) =>
        typeof value === "string" && value.trim().length >= 20
            ? value.trim()
            : "";
    const rule = {
        others: "avatar",
        why: "",
        arrival: "pose",
        arrivalWhy: "",
        problems,
    };
    if (typeof block !== "object" || Array.isArray(block)) {
        problems.push('game.json "avatars" must be an object');
        return rule;
    }
    if (
        block.others !== undefined &&
        !["avatar", "other"].includes(block.others)
    )
        problems.push('game.json "avatars.others" must be "avatar" or "other"');
    if (
        block.arrival !== undefined &&
        !["pose", "none"].includes(block.arrival)
    )
        problems.push('game.json "avatars.arrival" must be "pose" or "none"');
    if (block.others === "other") {
        rule.others = "other";
        rule.why = sentence(block.why);
        if (!rule.why)
            problems.push(
                'game.json "avatars.why" must say in a sentence why other people are not drawn as their Oncyber avatar'
            );
    }
    if (block.arrival === "none") {
        rule.arrival = "none";
        rule.arrivalWhy = sentence(block.arrivalWhy);
        if (!rule.arrivalWhy)
            problems.push(
                'game.json "avatars.arrivalWhy" must say in a sentence why the visitor does not arrive in the arrival pose'
            );
    }
    return rule;
}

/**
 * Problems with the frame the lobby reveals: the visitor, crouched, facing the camera, hands empty.
 * @param {Partial<AvatarFacts> | null | undefined} facts
 * @returns {string[]}
 */
export function arrivalProblems(facts) {
    if (!facts || typeof facts !== "object")
        return ["the game reported no avatar facts"];
    const problems = [];
    if (facts.avatarSelf !== "vrm" && facts.avatarSelf !== "stand-in")
        problems.push("no avatar for the visitor");
    if (facts.avatarSelfInFrame !== true)
        problems.push("the visitor's avatar is not in the arrival frame");
    if (facts.avatarArrival !== "crouched")
        problems.push(
            `the avatar is ${facts.avatarArrival ?? "not staged"}, not crouched`
        );
    if (facts.avatarFacingCamera !== true)
        problems.push("the avatar does not face the camera");
    if (facts.avatarHandsEmpty !== true)
        problems.push("the avatar's hands are not empty");
    return problems;
}

/**
 * Problems with how the other players in the room are drawn: `expected` of
 * them, `vouched` of whom have an avatar the page vouches for.
 * @param {Partial<AvatarFacts> | null | undefined} facts
 * @param {number} expected
 * @param {number} vouched
 * @returns {string[]}
 */
export function othersProblems(facts, expected, vouched) {
    if (!facts || typeof facts !== "object")
        return ["the game reported no avatar facts"];
    const problems = [];
    if (!(Number(facts.avatarOthersDrawn) >= expected))
        problems.push(
            `${facts.avatarOthersDrawn ?? 0} of ${expected} other players drawn`
        );
    if (!(Number(facts.avatarOthersVrm) >= vouched))
        problems.push(
            `${
                facts.avatarOthersVrm ?? 0
            } of ${vouched} other players drawn as their Oncyber avatar`
        );
    return problems;
}

/**
 * After the page said `entered`: the visitor stands up.
 * @param {Partial<AvatarFacts> | null | undefined} facts
 * @returns {string[]}
 */
export function enteredProblems(facts) {
    return facts?.avatarArrival === "standing"
        ? []
        : [
              `the avatar is ${
                  facts?.avatarArrival ?? "not staged"
              } after entering, not standing`,
          ];
}
