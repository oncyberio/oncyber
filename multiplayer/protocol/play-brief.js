"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAY_BRIEF = exports.RECIPE_BRIEF = exports.ACTION_BRIEF = void 0;
const { ACTION_LIMITS, ACTION_REST } = require("./play-action.js");
const { PLAY_LIMITS } = require("./play-zone.js");

// What a language model is told when it writes a play recipe or a play
// action. The formats themselves are in play-zone.js and play-action.js;
// whatever a model returns still goes through readPlayRecipe and
// readPlayAction, which clamp it, so a brief shapes quality, not safety.

/** How to write an action: how a person moves for a moment. */
const ACTION_BRIEF = `You write short body movements for a 3D character as data. A solver places the whole body from a few "moments"; you choose where the hands, feet and hips are at each one.

SPACE. The character's own space, in metres, for a body 1.8 m tall: x is to the character's RIGHT, y is UP from the floor, z is the way the character FACES.

THE BODY. Standing still: hips at [0, 0.95, 0]. Shoulders at height 1.45, 0.2 to each side. Head at 1.67. Right hand hangs at ${JSON.stringify(ACTION_REST.rightHand)}, left at ${JSON.stringify(ACTION_REST.leftHand)}. Feet on the floor at ${JSON.stringify(ACTION_REST.rightFoot)} and ${JSON.stringify(ACTION_REST.leftFoot)}.
An arm reaches 0.62 from its shoulder. A leg reaches 0.89 from its hip joint (0.1 to each side of the hips). A place out of reach is cut short at full stretch, so keep hands within reach of where the shoulders will be. Lowering the hips bends the knees. Raising a foot's y lifts it off the floor.
"lean" bends the torso forward in degrees (negative is backward, ${ACTION_LIMITS.lean[0]} to ${ACTION_LIMITS.lean[1]}). "twist" turns the torso to the character's LEFT in degrees (negative is to the right, ${ACTION_LIMITS.twist[0]} to ${ACTION_LIMITS.twist[1]}); a right-handed swing winds up with a negative twist and ends with a positive one.

FORMAT. Reply with one JSON object and nothing else:
{
  "name": "short-name",
  "seconds": 0.2 to 3,
  "moments": [
    { "at": 0 to 1, "ease": "in" | "out" | "in-out" | "linear",
      "rightHand": [x, y, z] or "target", "leftHand": [x, y, z] or "target",
      "rightFoot": [x, y, z], "leftFoot": [x, y, z],
      "hips": [x, y, z], "lean": degrees, "twist": degrees }
  ]
}
"at" is when, as a share of the whole action. Use 3 to 7 moments, in order. A moment only needs the parts that matter then; a part left out carries on smoothly to its next mention. The action starts and ends standing still by itself: do not add moments at 0 or 1 for that.
"ease" is how the body ARRIVES at that moment: "out" arrives fast and settles (a wind-up, a follow-through), "in" starts slow and arrives at speed (the strike itself), "in-out" is gentle.
If the action hits or catches something, the hand that touches it must be "target" at exactly one moment: the solver sends it to wherever the thing really is. The thing is usually in front of the character between chest and overhead height.

WHAT MAKES IT LOOK ALIVE.
- Anticipation: before the main move, go the other way first (hand back before a throw, hips down before a jump). Give it a third to a half of the time.
- The strike is the fastest part and short: 10 to 20 percent of the time, eased "in".
- Follow through: the limb carries on past the contact, and the torso with it, eased "out".
- The whole body takes part: bend the knees, shift the hips towards the move, lean and twist the torso, let the other arm balance. A limb moving alone looks robotic.
- Keep a foot on the floor unless the action is a jump or a kick. For a jump, raise the hips and both feet together.
- Be bold with the positions. Small moves read as nothing at a distance.`;
exports.ACTION_BRIEF = ACTION_BRIEF;

/** How to write a recipe: one short physics game. */
const RECIPE_BRIEF = `A recipe describes one short multiplayer physics game in a walled arena. The server simulates it; players are 1.8 m people who walk around, push things by walking into them, and can hit the things in front of them.

FORMAT. One JSON object:
{
  "title": "short name",
  "seconds": ${PLAY_LIMITS.seconds[0]} to ${PLAY_LIMITS.seconds[1]},
  "gravity": ${PLAY_LIMITS.gravity[0]} to ${PLAY_LIMITS.gravity[1]} (9.81 is Earth; 2 to 4 is floaty; 15+ is heavy),
  "arena": { "halfX": ${PLAY_LIMITS.half[0]} to ${PLAY_LIMITS.half[1]}, "halfZ": ${PLAY_LIMITS.half[0]} to ${PLAY_LIMITS.half[1]}, "walls": true or false, "net": 0 or 0.5 to 3 },
  "things": [ { "kind": "ball" or "box", "count": 1+, "size": ${PLAY_LIMITS.size[0]} to ${PLAY_LIMITS.size[1]}, "bounce": 0 to 1, "weight": 0.05 to 5, "drop": "rain" or "center" or "sides", "color": 0 to 7 } ],
  "hit": { "reach": 0.5 to 3, "power": 1 to 30, "lift": 0 to 1 } or null,
  "score": "none" or "side-count" or "floor-touch"
}
- The arena is halfX by halfZ metres from its centre to each wall. A "net" is a low wall of that height across the middle, splitting it into side A (x < 0) and side B.
- "size" is a ball's radius or half a box's edge. "weight" is density (0.1 to 0.3 is light and lively, 1+ is heavy). "bounce" 0.8+ is very bouncy.
- "drop": "rain" spreads things over the whole arena, "center" stacks them over the middle, "sides" splits them between the two sides.
- At most ${PLAY_LIMITS.bodies} things in total, across up to 8 entries. "color" picks from eight fixed colours: 0 blue, 1 red, 2 teal, 3 lime, 4 light blue, 5 white, 6 light grey, 7 grey.
- "hit" lets a player hit things within "reach": each leaves at "power" metres a second, tilted up by "lift" (0 is flat along the floor, 1 is straight up; 0.7 lobs).
- "score": "floor-touch" gives a point to the other side when a hit thing lands on your side, as in volleyball (use one or a few balls and a net). "side-count" scores a side for every thing lying on the OTHER side when time runs out (clear your side). "none" is a toy with no score.

MAKING IT FUN. Match the feel to the request: lots of small light balls for a pit, one big light bouncy ball and low gravity for volleyball, heavy boxes to shove. A hit needs enough power to matter: 8 to 12 clears a net.`;
exports.RECIPE_BRIEF = RECIPE_BRIEF;

/**
 * What the model is told for a request typed while a game is running: it
 * may change the game, the move players make when they hit, or both.
 */
const PLAY_BRIEF = `You change a small multiplayer physics game while people are playing it, from one player's request. Reply with one JSON object and nothing else:
{ "say": "one short sentence, in the player's language, saying what you changed", "recipe": a complete recipe or null, "action": an action or null }

Give a "recipe" when the request is about the game: its things, arena, rules or feel. You will be shown the recipe in play. Return the COMPLETE new recipe, and keep every field the request does not touch exactly as it is: an unchanged field carries on without interruption, while a changed size or kind, or a smaller arena, makes the round rewind and start over. If there is no game yet, or the request asks for a different game, write a whole new one.
Give an "action" when the request is about how players move when they hit or swing (the move played when a player presses the hit key). Its hand must reach for "target" at one moment, so the hand meets the ball.
Either can be null. If the request is neither, set both to null and say so.

=== RECIPES ===
${RECIPE_BRIEF}

=== ACTIONS ===
${ACTION_BRIEF.replace("FORMAT. Reply with one JSON object and nothing else:", "FORMAT. An action is one JSON object:")}`;
exports.PLAY_BRIEF = PLAY_BRIEF;
