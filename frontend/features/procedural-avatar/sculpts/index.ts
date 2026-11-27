import { stagehandSculpt } from "./stagehand";
import type { Sculpt } from "./types";

export type { Sculpt } from "./types";

/** Characters sculpted whole as distance fields, by catalogue id. */
export const SCULPTS: Record<string, () => Sculpt> = {
    stagehand: stagehandSculpt,
};
