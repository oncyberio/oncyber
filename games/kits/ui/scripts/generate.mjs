#!/usr/bin/env node
// Generates the games UI kit's CSS from the design tokens.
//
//   node games/kits/ui/scripts/generate.mjs          write oncyber-ui.css, fonts.css, fonts/
//   node games/kits/ui/scripts/generate.mjs --check  exit 1 if they differ from the tokens
//
// Every value comes from frontend/styles/tokens/. The few the brand guide
// gives without a token (the spacing rhythm, the panel title size) are in
// `guide` below, each with the place it comes from. The brand fonts are
// licensed and never copied; fonts.css registers the open ones the site
// itself falls back to.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const kitDir = resolve(here, "..");
const root = resolve(kitDir, "../../..");
const tokensDir = join(root, "frontend/styles/tokens");
const fontsDir = join(root, "frontend/public/fonts");

/** The open fonts the kit ships: [file in the kit, source, family, weight]. */
export const FONTS = [
    ["SpaceGrotesk-Regular.woff2", "SpaceGrotesk/SpaceGrotesk-Regular.woff2", "SpaceGrotesk", 400],
    ["SpaceGrotesk-Medium.woff2", "SpaceGrotesk/SpaceGrotesk-Medium.woff2", "SpaceGrotesk", 500],
    ["SpaceMono-Regular.woff2", "SpaceMono/SpaceMono-Regular.woff2", "Oncyber Mono", 400],
];

/** Brand guide values that have no token yet (docs/brand/README.md). */
export const guide = {
    /** "Shape, spacing, and controls": the 4 px rhythm. */
    space: [4, 8, 12, 16, 20, 24, 32],
    /** "Typography": panel title, Aeonik 500 at 16 px / 1.5. */
    titleSize: 16,
    lineHeight: 1.5,
    /** "Typography": small section labels, tracking 0.02em. */
    labelTracking: "0.02em",
    /** "Motion": a popover enters with 4 px of vertical travel. */
    enterTravel: 4,
    /** Behind a dialog. The site's dialogs dim the page the same amount. */
    scrim: "#00000080",
};

/** The token files are TypeScript with extensionless imports. */
export async function loadTokens() {
    const hooks = registerHooks({
        resolve(specifier, context, next) {
            if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(tokensDir).href)) {
                const file = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`);
                if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
            }
            return next(specifier, context);
        },
    });
    try {
        const load = (name) => import(pathToFileURL(join(tokensDir, `${name}.ts`)).href);
        const [base, action, landing, lobby] = await Promise.all(["base", "action", "landing", "lobby"].map(load));
        return { base: base.baseTokens, action: action.actionTokens, landing: landing.landingTokens, lobby: lobby.lobbyTokens };
    } finally {
        hooks.deregister();
    }
}

/** `--oui-*` variables, in order. The only place token values enter the CSS. */
export function variables({ base, action, landing, lobby }) {
    const px = (n) => `${n}px`;
    const ms = (n) => `${n}ms`;
    return {
        // Type. The licensed names come first and resolve only where the
        // page has them; in a game's frame the open fallbacks draw.
        font: action.type.family,
        "font-mono": base.font.mono,
        "text-micro": px(base.font.size.micro),
        "text-xs": px(base.font.size.xs),
        "text-sm": px(base.font.size.sm),
        "text-md": px(base.font.size.md),
        "text-body": px(base.font.size.body),
        "text-title": px(guide.titleSize),
        "line-height": guide.lineHeight,
        "weight-regular": base.font.weight.regular,
        "weight-medium": base.font.weight.medium,
        "label-tracking": guide.labelTracking,
        // Ink and hairlines.
        ink: base.color.ink,
        secondary: base.color.secondary,
        muted: base.color.muted,
        accent: base.color.accent,
        "line-faint": base.color.line.faint,
        "line-subtle": base.color.line.subtle,
        "line-soft": base.color.line.soft,
        "line": base.color.line.default,
        "line-strong": base.color.line.strong,
        "line-hover": base.color.line.hover,
        "line-selected": base.color.line.selected,
        // Glass: panels over the 3D world, as in the lobby.
        "glass-fallback": lobby.glass.fallback,
        "glass-tint": lobby.glass.tint,
        "glass-sheen": lobby.glass.sheen,
        "glass-blur": px(lobby.glass.panelBlur),
        "glass-shadow": lobby.glass.shadow,
        "notice": lobby.control.notice,
        "notice-ink": lobby.color.noticeStrong,
        "notice-border": lobby.control.border,
        // Solid: dialogs, as on the landing.
        "solid": landing.color.panel,
        "solid-border": landing.color.line,
        "solid-shadow": landing.shadow.card,
        scrim: guide.scrim,
        // Corners and spacing.
        "radius-inset": px(base.radius.inset),
        "radius-control": px(base.radius.control),
        "radius-card": px(base.radius.card),
        "radius-panel": px(base.radius.panel),
        "radius-pill": px(action.radius.pill),
        ...Object.fromEntries(guide.space.map((n, i) => [`space-${i + 1}`, px(n)])),
        // The one button spec.
        "action-height": px(action.size.minHeight),
        "action-padding": `${px(action.size.paddingY)} ${px(action.size.paddingX)}`,
        "action-gap": px(action.size.gap),
        "action-gap-compact": px(action.size.compactGap),
        "action-border": px(action.size.borderWidth),
        "action-font": action.type.font,
        "white-ink": action.white.ink,
        "white-fill": action.white.fill,
        "white-hover": action.white.hover,
        "white-pressed": action.white.pressed,
        "outline-ink": action.outline.ink,
        "outline-border": action.outline.border,
        "outline-hover-fill": action.outline.hoverFill,
        "outline-hover-border": action.outline.hoverBorder,
        "outline-pressed-fill": action.outline.pressedFill,
        "blue-ink": action.blue.ink,
        "blue-fill": `linear-gradient(180deg, ${action.blue.start} 0%, ${action.blue.fill} 52%, ${action.blue.end} 100%)`,
        "blue-shadow": landing.shadow.action,
        "disabled-opacity": action.state.disabledOpacity,
        "touch-target": px(lobby.control.touchSize),
        "panel-width": px(lobby.panel.compactWidth),
        // Focus and motion.
        "focus-ring": `${px(action.state.focusWidth)} solid ${action.state.focusRing}`,
        "focus-offset": px(base.focus.offset),
        "focus-offset-action": px(action.state.focusOffset),
        fast: ms(base.motion.fast),
        standard: ms(base.motion.standard),
        enter: ms(base.motion.enter),
        ease: base.motion.ease,
        "enter-travel": px(guide.enterTravel),
    };
}

export function renderKit(tokens) {
    const vars = variables(tokens);
    const { base } = tokens;
    const declarations = Object.entries(vars)
        .map(([name, value]) => `    --oui-${name}: ${value};`)
        .join("\n");
    const template = readFileSync(join(kitDir, "src/elements.css"), "utf8")
        .replaceAll("__PHONE__", `${base.breakpoint.phone}px`)
        .replaceAll("__COMPACT__", `${base.breakpoint.compact}px`);
    const used = new Set([...template.matchAll(/var\(--oui-([a-z0-9-]+)/g)].map((m) => m[1]));
    const unknown = [...used].filter((name) => !(name in vars));
    if (unknown.length) throw new Error(`src/elements.css uses unknown variables: ${unknown.join(", ")}`);
    return `/* Oncyber games UI kit. GENERATED by games/kits/ui/scripts/generate.mjs from
   frontend/styles/tokens/ and src/elements.css. Do not edit; change the
   tokens or the template and run \`pnpm games:ui\`. */
:root {
${declarations}
}
@media (prefers-reduced-motion: reduce) {
    :root {
        --oui-fast: 0ms;
        --oui-standard: 0ms;
        --oui-enter: 0ms;
        --oui-enter-travel: 0px;
    }
}

${template}`;
}

export function renderFonts() {
    const faces = FONTS.map(
        ([file, , family, weight]) => `@font-face {
    font-family: "${family}";
    src: url("./fonts/${file}") format("woff2");
    font-weight: ${weight};
    font-style: normal;
    font-display: swap;
}`
    ).join("\n");
    return `/* Open fonts for the games UI kit (SIL Open Font License, see fonts/OFL.txt).
   GENERATED by games/kits/ui/scripts/generate.mjs. Optional: without it the
   kit draws in the system sans. The licensed brand fonts are never bundled. */
${faces}
`;
}

/** Each generated file: [path in the kit, wanted bytes]. */
export async function outputs() {
    const tokens = await loadTokens();
    return [
        ["oncyber-ui.css", Buffer.from(renderKit(tokens))],
        ["fonts.css", Buffer.from(renderFonts())],
        ["fonts/OFL.txt", readFileSync(join(fontsDir, "SpaceGrotesk/OFL.txt"))],
        ["fonts/OFL-SpaceMono.txt", readFileSync(join(fontsDir, "SpaceMono/OFL.txt"))],
        ...FONTS.map(([file, from]) => [`fonts/${file}`, readFileSync(join(fontsDir, from))]),
    ];
}

/** Paths whose committed bytes differ from what the tokens give now. */
export async function drift() {
    const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
    return (await outputs())
        .filter(([path, bytes]) => !existsSync(join(kitDir, path)) || sha(readFileSync(join(kitDir, path))) !== sha(bytes))
        .map(([path]) => path);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes("--check")) {
        const changed = await drift();
        if (changed.length) {
            console.error(`games UI kit is out of date with the tokens: ${changed.join(", ")}\nRun: pnpm games:ui`);
            process.exit(1);
        }
        console.log("games UI kit matches the tokens");
    } else {
        for (const [path, bytes] of await outputs()) {
            mkdirSync(dirname(join(kitDir, path)), { recursive: true });
            writeFileSync(join(kitDir, path), bytes);
        }
        console.log("wrote games/kits/ui/oncyber-ui.css, fonts.css and fonts/");
    }
}
