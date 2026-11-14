// games:check stage: do the game's menu screens use the UI kit?
//
// A warning, never a failure: the kit is optional and a game's world keeps
// its own look. What it flags is a menu, setup screen or picker that uses
// none of the kit's classes (games/kits/ui, the `oui-` prefix), so the
// screens that should look like Oncyber are easy to find.
//
// A menu screen here is a top-level block of the game's page (or of its UI
// frame) holding two or more controls a visitor can press. Hidden screens
// count, since menus are mostly hidden at boot; touch pads and other
// `aria-hidden` blocks don't, nor does anything inside a canvas.

export const KIT_CLASS = /^oui(-|$)/;
const CONTROLS = new Set(["button", "select", "input", "textarea"]);
const CONTROL_ROLES = new Set(["button", "switch", "radio", "checkbox", "option", "menuitem", "tab", "slider"]);
const SKIP = new Set(["script", "style", "canvas", "template", "noscript", "svg", "head"]);

/**
 * Runs in the page. Returns the body as plain data:
 * `{ tag, id, classes, role, hidden, href, type, children }`.
 */
export function snapshotDom() {
    const walk = (el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || "",
        classes: [...el.classList],
        role: el.getAttribute("role") || "",
        hidden: el.getAttribute("aria-hidden") === "true",
        href: el.hasAttribute("href"),
        type: el.getAttribute("type") || "",
        children: [...el.children].map(walk),
    });
    return document.body ? walk(document.body) : null;
}

const skipped = (node) => SKIP.has(node.tag) || node.hidden;
const isControl = (node) =>
    (CONTROLS.has(node.tag) && node.type !== "hidden") || (node.tag === "a" && node.href) || CONTROL_ROLES.has(node.role);

function tally(node) {
    if (skipped(node)) return { controls: 0, kit: false };
    let controls = isControl(node) ? 1 : 0;
    let kit = node.classes.some((name) => KIT_CLASS.test(name));
    for (const child of node.children) {
        const inner = tally(child);
        controls += inner.controls;
        kit ||= inner.kit;
    }
    return { controls, kit };
}

const nameOf = (node) => (node.id ? `#${node.id}` : node.classes.length ? `.${node.classes[0]}` : node.tag);

/** The menu screens in one page snapshot: `[{ name, controls, kit }]`. */
export function menuScreens(body) {
    if (!body) return [];
    // Step through wrappers (#app, #root): a lone child that holds every control.
    let rootNode = body;
    for (;;) {
        const holders = rootNode.children.filter((child) => tally(child).controls > 0);
        if (holders.length !== 1 || isControl(holders[0]) || tally(holders[0]).controls < 2) break;
        // A named screen is a screen, not a wrapper, once its children are single controls.
        if (!holders[0].children.some((child) => tally(child).controls >= 2)) break;
        rootNode = holders[0];
    }
    return rootNode.children
        .map((child) => ({ name: nameOf(child), ...tally(child) }))
        .filter((screen) => screen.controls >= 2);
}

/**
 * Warnings for a game from its page snapshots (the game frame and any
 * frame inside it). One warning lists every screen without the kit.
 */
export function uiKitReport(snapshots) {
    const screens = snapshots.flatMap(menuScreens);
    const without = screens.filter((screen) => !screen.kit);
    const warnings = without.length
        ? [
              {
                  code: "UI_KIT_UNUSED",
                  message: `${without.length} of ${screens.length} menu screen(s) use no UI kit classes: ${without
                      .map((s) => s.name)
                      .join(", ")}. See docs/games/ui-kit.md.`,
              },
          ]
        : [];
    return { screens, warnings };
}

/** Snapshot every frame under the check harness and report. */
export async function scanUiKit(page) {
    const snapshots = [];
    for (const frame of page.frames()) {
        if (frame === page.mainFrame()) continue;
        try {
            snapshots.push(await frame.evaluate(snapshotDom));
        } catch {
            // A frame that went away mid-check has nothing to report.
        }
    }
    return uiKitReport(snapshots.filter(Boolean));
}
