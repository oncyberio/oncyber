/**
 * Live previews of a proposed change, in this tab only. A patch is data, not
 * code: CSS plus a few DOM operations, so nothing the assistant writes can
 * run as script on the page (where it could read the visitor's tokens).
 */
export type LiveOp = {
    selector: string;
    text?: string;
    attr?: string;
    value?: string;
    style?: Record<string, string>;
    hide?: boolean;
};

export type LivePatch = { css?: string; ops?: LiveOp[] };

const ALLOWED_ATTRS = new Set([
    "class",
    "title",
    "alt",
    "placeholder",
    "aria-label",
]);

/** Root of the contributor UI, which patches never touch. */
export const CONTRIBUTOR_ROOT = "data-oncyber-contributor";

export function sanitizePatch(patch: any): LivePatch {
    const out: LivePatch = {};
    if (typeof patch?.css === "string" && patch.css.trim()) {
        // No imports of outside stylesheets, no legacy script hooks.
        const css = patch.css
            .replace(/@import[^;]*;?/gi, "")
            .replace(/expression\s*\(/gi, "")
            .replace(/javascript:/gi, "")
            .trim();
        if (css) out.css = css;
    }
    if (Array.isArray(patch?.ops)) {
        out.ops = patch.ops
            .filter((op) => op && typeof op.selector === "string")
            .map((op) => {
                const clean: LiveOp = { selector: op.selector.slice(0, 300) };
                if (typeof op.text === "string") clean.text = op.text;
                if (
                    typeof op.attr === "string" &&
                    ALLOWED_ATTRS.has(op.attr.toLowerCase()) &&
                    typeof op.value === "string"
                ) {
                    clean.attr = op.attr.toLowerCase();
                    clean.value = op.value;
                }
                if (op.style && typeof op.style === "object") {
                    clean.style = {};
                    for (const [key, value] of Object.entries(op.style)) {
                        if (typeof value !== "string") continue;
                        if (/javascript:|expression\s*\(/i.test(value))
                            continue;
                        clean.style[key] = value;
                    }
                }
                if (op.hide === true) clean.hide = true;
                return clean;
            });
    }
    return out;
}

type Saved = {
    text?: string;
    attrs: Record<string, string | null>;
    style: Record<string, string>;
};

function select(selector: string, root: ParentNode): Element[] {
    try {
        return [...root.querySelectorAll(selector)].filter(
            (element) => !element.closest(`[${CONTRIBUTOR_ROOT}]`)
        );
    } catch {
        return [];
    }
}

/**
 * Applies patches and keeps them applied as the page re-renders. Returns a
 * function that restores everything it changed.
 */
export function applyLivePatches(
    patches: LivePatch[],
    doc: Document = document
): () => void {
    const style = doc.createElement("style");
    style.setAttribute(CONTRIBUTOR_ROOT, "styles");
    style.textContent = patches
        .map((patch) => patch.css || "")
        .filter(Boolean)
        .join("\n");
    doc.head.appendChild(style);

    const saved = new Map<Element, Saved>();
    const ops = patches.flatMap((patch) => patch.ops || []);
    let applying = false;

    const run = () => {
        applying = true;
        for (const op of ops) {
            for (const element of select(op.selector, doc)) {
                const html = element as HTMLElement;
                let record = saved.get(element);
                if (!record) {
                    record = { attrs: {}, style: {} };
                    saved.set(element, record);
                }
                if (op.text !== undefined && html.textContent !== op.text) {
                    if (record.text === undefined)
                        record.text = html.textContent;
                    html.textContent = op.text;
                }
                if (op.attr && element.getAttribute(op.attr) !== op.value) {
                    if (!(op.attr in record.attrs))
                        record.attrs[op.attr] = element.getAttribute(op.attr);
                    element.setAttribute(op.attr, op.value);
                }
                const styles = { ...(op.style || {}) };
                if (op.hide) styles.display = "none";
                for (const [key, value] of Object.entries(styles)) {
                    const name = key.replace(
                        /[A-Z]/g,
                        (c) => "-" + c.toLowerCase()
                    );
                    if (html.style?.getPropertyValue(name) === value) continue;
                    if (!(name in record.style))
                        record.style[name] = html.style.getPropertyValue(name);
                    html.style.setProperty(name, value, "important");
                }
            }
        }
        applying = false;
    };

    run();
    let frame = 0;
    const observer =
        ops.length && typeof MutationObserver !== "undefined"
            ? new MutationObserver(() => {
                  if (applying || frame) return;
                  frame = requestAnimationFrame(() => {
                      frame = 0;
                      run();
                  });
              })
            : null;
    observer?.observe(doc.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    return () => {
        observer?.disconnect();
        if (frame) cancelAnimationFrame(frame);
        style.remove();
        for (const [element, record] of saved) {
            const html = element as HTMLElement;
            if (record.text !== undefined) html.textContent = record.text;
            for (const [name, value] of Object.entries(record.attrs)) {
                if (value === null) element.removeAttribute(name);
                else element.setAttribute(name, value);
            }
            for (const [name, value] of Object.entries(record.style)) {
                if (value) html.style.setProperty(name, value);
                else html.style.removeProperty(name);
            }
        }
    };
}

const escape = (name: string) =>
    globalThis.CSS?.escape
        ? CSS.escape(name)
        : name.replace(/[^\w-]/g, (c) => "\\" + c);

/** A short CSS path for an element, for the assistant and for patches. */
export function describeElement(element: Element) {
    const path: string[] = [];
    let node: Element | null = element;
    while (node && node.nodeType === 1 && path.length < 5) {
        let part = node.tagName.toLowerCase();
        if (node.id && !/\d{3,}|:/.test(node.id)) {
            path.unshift(`${part}#${escape(node.id)}`);
            break;
        }
        const classes = [...node.classList]
            // styled-components hashes (sc-…, kHjzZx) change every build.
            .filter(
                (name) =>
                    !/^sc-/.test(name) &&
                    !/^(?=.*[a-z])(?=.*[A-Z])[a-zA-Z]{5,8}$/.test(name)
            )
            .slice(0, 2);
        if (classes.length)
            part += classes.map((name) => "." + escape(name)).join("");
        const parent = node.parentElement;
        if (parent) {
            const same = [...parent.children].filter(
                (child) => child.tagName === node.tagName
            );
            if (same.length > 1)
                part += `:nth-of-type(${same.indexOf(node) + 1})`;
        }
        path.unshift(part);
        node = node.parentElement;
    }
    const html = element.outerHTML.replace(/\s+/g, " ");
    return {
        selector: path.join(" > "),
        text: (element.textContent || "").trim().slice(0, 300),
        html: html.length > 1500 ? html.slice(0, 1500) + "…" : html,
        classes: [...element.classList].join(" "),
    };
}
