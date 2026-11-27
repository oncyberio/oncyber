/**
 * game.json: what a game declares about itself, and the rules it must meet.
 * `validateGameJson` is what `pnpm games:check` runs before the game boots.
 * No dependencies, so the check script, the games and tests share it.
 */
import type { GameManifest } from "./index.ts";

/** How a visitor from the lobby lands. */
export interface ArrivalDeclaration {
    /**
     * true: the visitor is revealed standing in the world, in the lobby's
     * third-person framing, and can walk before anything starts. The page
     * waits (briefly) for the game to stage that frame.
     * false: the game opens on its own screen; the page doesn't wait.
     */
    walkable: boolean;
}
export interface PartyFormat {
    /** `singles`, `doubles`, `tournament`, ... */
    id: string;
    label: string;
    /** Party sizes (visitor included) this format takes. */
    sizes: number[];
}
/** What a party that travelled together can do here. */
export interface PartyDeclaration {
    /** Smallest and largest party the game takes, 1 to 8. `[1, 1]` is a solo game. */
    sizes: [number, number];
    /** Every size in `sizes` must have at least one format. */
    formats: PartyFormat[];
}
/** The whole of game.json. */
export interface GameJson {
    name: string;
    avatar?: string;
    arrival?: ArrivalDeclaration;
    party?: PartyDeclaration;
    runtime?: GameManifest;
}

export const PARTY_MAX = 8;
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const ACTION = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;
const plain = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === "object" && !Array.isArray(v);
const size = (v: unknown): v is number =>
    Number.isInteger(v) && (v as number) >= 1 && (v as number) <= PARTY_MAX;

export interface ManifestFinding {
    code: string;
    message: string;
}

/** Problems with `arrival`. Empty when it is well formed. */
export function validateArrival(value: unknown): string[] {
    if (!plain(value))
        return ['arrival must be an object: { "walkable": true | false }'];
    if (typeof value.walkable !== "boolean")
        return ["arrival.walkable must be true or false"];
    return [];
}

/** Problems with `party`. Empty when it is well formed. */
export function validateParty(value: unknown): string[] {
    if (!plain(value))
        return [
            'party must be an object: { "sizes": [min, max], "formats": [...] }',
        ];
    const errors: string[] = [];
    const sizes = value.sizes;
    const range =
        Array.isArray(sizes) &&
        sizes.length === 2 &&
        size(sizes[0]) &&
        size(sizes[1]) &&
        sizes[0] <= sizes[1];
    if (!range)
        errors.push(
            `party.sizes must be [min, max] with 1 <= min <= max <= ${PARTY_MAX}`
        );
    if (
        !Array.isArray(value.formats) ||
        !value.formats.length ||
        value.formats.length > 16
    ) {
        errors.push("party.formats must list 1 to 16 formats");
        return errors;
    }
    const ids = new Set<string>(),
        covered = new Set<number>();
    value.formats.forEach((format: any, index: number) => {
        const at = `party.formats[${index}]`;
        if (!plain(format)) return errors.push(`${at} must be an object`);
        if (typeof format.id !== "string" || !ID.test(format.id))
            errors.push(
                `${at}.id must be lowercase letters, digits and dashes`
            );
        else if (ids.has(format.id))
            errors.push(`${at}.id "${format.id}" is listed twice`);
        else ids.add(format.id);
        if (
            typeof format.label !== "string" ||
            !format.label.trim() ||
            format.label.length > 40
        )
            errors.push(`${at}.label must be 1 to 40 characters`);
        if (
            !Array.isArray(format.sizes) ||
            !format.sizes.length ||
            !format.sizes.every(size) ||
            new Set(format.sizes).size !== format.sizes.length
        )
            errors.push(
                `${at}.sizes must list distinct party sizes from 1 to ${PARTY_MAX}`
            );
        else
            for (const n of format.sizes) {
                if (range && (n < sizes[0] || n > sizes[1]))
                    errors.push(
                        `${at}.sizes has ${n}, outside party.sizes [${sizes[0]}, ${sizes[1]}]`
                    );
                covered.add(n);
            }
    });
    if (range)
        for (let n = sizes[0]; n <= sizes[1]; n++)
            if (!covered.has(n))
                errors.push(
                    `a party of ${n} has no format; add one or narrow party.sizes`
                );
    return errors;
}

/** Problems with the `runtime` block's input declarations. */
function validateInput(runtime: Record<string, any>): string[] {
    const errors: string[] = [];
    if (!plain(runtime.input) || !Object.keys(runtime.input).length)
        return ["runtime.input must declare at least one action"];
    for (const [action, binding] of Object.entries(runtime.input)) {
        if (!ACTION.test(action))
            errors.push(
                `runtime.input.${action}: action names are letters and digits`
            );
        if (!plain(binding))
            errors.push(`runtime.input.${action} must be an object`);
        else if (
            binding.keyboard !== undefined &&
            !(
                Array.isArray(binding.keyboard) &&
                binding.keyboard.every(
                    (k: unknown) =>
                        typeof k === "string" &&
                        /^[A-Z][A-Za-z0-9]{1,23}$/.test(k)
                )
            )
        )
            errors.push(
                `runtime.input.${action}.keyboard must list KeyboardEvent.code values`
            );
    }
    return errors;
}

/**
 * Everything wrong with a game.json, as findings the check prints.
 * `arrival` and `party` are checked when present; `requireContract` (a
 * listed game) makes them, and the lifecycle's `runtime` block, mandatory.
 */
export function validateGameJson(
    value: unknown,
    options: { requireContract?: boolean } = {}
): ManifestFinding[] {
    const finding = (message: string): ManifestFinding => ({
        code: "MANIFEST_INVALID",
        message,
    });
    if (!plain(value)) return [finding("game.json must be an object")];
    const findings: ManifestFinding[] = [];
    if (typeof value.name !== "string" || !value.name.trim())
        findings.push(finding("name is required"));
    if (value.arrival !== undefined)
        findings.push(...validateArrival(value.arrival).map(finding));
    else if (options.requireContract)
        findings.push(
            finding('arrival is required: { "walkable": true | false }')
        );
    if (value.party !== undefined)
        findings.push(...validateParty(value.party).map(finding));
    else if (options.requireContract)
        findings.push(
            finding(
                'party is required: { "sizes": [min, max], "formats": [...] }'
            )
        );
    if (plain(value.runtime)) {
        if (value.runtime.profile !== "portable-v1")
            findings.push(finding('runtime.profile must be "portable-v1"'));
        if (!Array.isArray(value.runtime.capabilities))
            findings.push(finding("runtime.capabilities must be a list"));
        if (!Array.isArray(value.runtime.assets))
            findings.push(finding("runtime.assets must be a list"));
        findings.push(...validateInput(value.runtime).map(finding));
    } else if (value.runtime !== undefined)
        findings.push(finding("runtime must be an object"));
    return findings;
}

/** The declared formats a party of `count` can play, in manifest order. */
export function formatsForParty(
    party: PartyDeclaration,
    count: number
): PartyFormat[] {
    return party.formats.filter((format) => format.sizes.includes(count));
}
