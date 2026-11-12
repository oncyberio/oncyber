import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

import { scoresync, scoreSyncCron } from "./https/scoresync";
import { optimize_v2_ipfs } from "https/optimize_v2_ipfs";
import { upload_v2_ipfs } from "https/upload_v2_ipfs";
import { vrmoptization_ipfs } from "https/vrmopti_ipfs";
import { pruneRealtimeEvents } from "./scheduled/pruneRealtimeEvents";

export {
    optimize_v2_ipfs,
    scoreSyncCron,
    vrmoptization_ipfs,
    upload_v2_ipfs,
    pruneRealtimeEvents,
};
