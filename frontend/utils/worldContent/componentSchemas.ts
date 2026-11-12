import { z } from "zod";

/**
 * Per-`type` shape validation for `exhibit.kitbash` items.
 *
 * Nothing in the existing kitbash pipeline validates payload shape — the
 * studio UI only ever constructs well-formed items, so `KitBashData` stayed
 * `[key: string]: any` and the server never checked it (see
 * `pages/api/_v2/exhibit/update.ts`). That's not safe once callers other than
 * the studio UI (a CLI, an AI-driven generation pass) can write directly.
 * These schemas are the one shared gate both server-side validation and the
 * client-side builder functions (`./index.ts`) validate against, so a write
 * is checked the same way regardless of where it came from.
 *
 * Field shapes mirror the real defaults in each component's `data.js`
 * (`components/_3DExhibit-v2/three/factory/space/kits/cyber/components/*`)
 * as of this writing — keep in sync if those change.
 */

const xyz = z.object({ x: z.number(), y: z.number(), z: z.number() });

const base = z.object({
    id: z.string().min(1),
    kit: z.literal("cyber"),
    addedBy: z.string().optional(),
    _version: z.number().optional(),
    groupId: z.string().optional(),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Expected a hex color");

export const terrainSchema = base.extend({
    type: z.literal("terrain"),
    position: xyz,
    rotation: xyz,
    scale: xyz,
    color: hexColor,
    noiseEnabled: z.boolean(),
    definition: z.number().positive(),
    seed: z.number(),
    noiseDomain: z.number(),
    smoothCenter: z.number(),
    tiles: z.number().positive().optional(),
    collision: z.boolean().optional(),
    mode: z.enum(["color", "texture", "shader"]),
    shader: z.enum(["grid", "biplanar"]).optional(),
    griddiv: z.number().positive().optional(),
    textureOpts: z.object({ id: z.string() }).passthrough().optional(),
    textureSideOpts: z.object({ id: z.string() }).passthrough().optional(),
    edgeTransition: z.number().optional(),
    noTileDisplacement: z.number().optional(),
    smoothAngle: z.number().optional(),
});

export const meshSchema = base.extend({
    type: z.literal("mesh"),
    position: xyz,
    rotation: xyz,
    scale: xyz,
    color: hexColor,
    opacity: z.number().min(0).max(1),
});

export const lightSchema = base.extend({
    type: z.literal("lighting"),
    enabled: z.boolean(),
    lightDirection: xyz,
    lightPosition: xyz,
    bias: z.number(),
    near: z.number(),
    far: z.number(),
    intensity: z.number().min(0),
    size: z.number().positive(),
});

export const waterSchema = base.extend({
    type: z.literal("water"),
    color: hexColor,
    opacity: z.number().min(0).max(1),
    scale: z.object({ x: z.number(), z: z.number() }),
    position: xyz,
    collision: z.boolean().optional(),
});

export const spawnSchema = base.extend({
    type: z.literal("spawn"),
    position: xyz,
    rotation: xyz,
});

/**
 * Every structural type this pass adds validation for. Deliberately narrow:
 * oncyber's existing kitbash surface also includes catalog-driven mesh chunks
 * from uploaded kit GLBs, whose `type` values come from that catalog and
 * aren't known here — those must keep writing exactly as they do today, so
 * `validateKitbashItem` passes any `type` outside this map through unchanged
 * rather than rejecting it. This closes the validation gap for the specific
 * structural types the new world-content API writes, not the entire kitbash
 * surface.
 */
export const componentSchemas = {
    terrain: terrainSchema,
    mesh: meshSchema,
    lighting: lightSchema,
    water: waterSchema,
    spawn: spawnSchema,
} as const;

export type StructuralComponentType = keyof typeof componentSchemas;

export type TerrainPayload = z.infer<typeof terrainSchema>;
export type MeshPayload = z.infer<typeof meshSchema>;
export type LightPayload = z.infer<typeof lightSchema>;
export type WaterPayload = z.infer<typeof waterSchema>;
export type SpawnPayload = z.infer<typeof spawnSchema>;

export interface ValidationResult {
    success: boolean;
    error?: string;
}

/**
 * Validates one full kitbash item. Only meaningful for whole-item
 * add/replace patches (`path === ["kitbash", id]`) — a deep partial-field
 * patch (`path === ["kitbash", id, "position", "x"]`) isn't a full item and
 * isn't validated by this pass; that remains a known gap (see plan).
 */
export function validateKitbashItem(value: unknown): ValidationResult {
    if (value == null || typeof value !== "object") {
        return { success: false, error: "Kitbash item must be an object" };
    }

    const type = (value as { type?: unknown }).type;

    if (typeof type !== "string" || !(type in componentSchemas)) {
        // Not one of the types this module knows about (catalog-driven
        // kitbash mesh chunks, etc.) — pass through unchanged, see comment
        // on `componentSchemas` above.
        return { success: true };
    }

    const schema = componentSchemas[type as StructuralComponentType];

    const result = schema.safeParse(value);

    if (result.success) return { success: true };

    return {
        success: false,
        error: result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
    };
}
