import { stagehandSculpt } from "./stagehand";
import type { BuildOptions } from "../humanoid/description";
import type { Sculpt } from "./types";

export type { Sculpt } from "./types";

/** Characters sculpted whole as distance fields, by catalogue id. */
export const SCULPTS: Record<string, (options?: BuildOptions) => Sculpt> = {
    stagehand: stagehandSculpt,
};
