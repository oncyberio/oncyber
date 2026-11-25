/**
 * Links out of a framed world (docs/plans/framed-worlds.md, slice 4). A
 * world cannot open a tab or leave its frame, so anything in it that would
 * (an artwork's marketplace link, a link portal, a share button, a script)
 * is a request to the page instead: `open-link` for a new tab, `travel` for
 * a link to another page of the site. The page shows where a link goes and
 * opens it only on the visitor's own click.
 */
import type { WorldFrame } from "./worldFrame";

/** A link as the page will offer it: where it goes, and the host to show. */
export interface WorldLink {
    href: string;
    host: string;
}

/** A link a world may ask the page to open, or null. Web addresses only. */
export function readWorldLink(value: unknown, site: string): WorldLink | null {
    if (typeof value !== "string" || !value || value.length > 2048) return null;
    try {
        const url = new URL(value, site);
        if (!/^https?:$/.test(url.protocol) || url.username || url.password)
            return null;
        return { href: url.href, host: url.host };
    } catch {
        return null;
    }
}

/**
 * The world's side: turns every way out of the document into a request to
 * the page. Returns a function that undoes it.
 */
export function captureWorldLinks(
    win: Window,
    frame: WorldFrame,
    post: (kind: string, data: object) => void
) {
    // An address on the world host is the same address on the site.
    const onSite = (url: URL) =>
        url.origin === frame.world
            ? frame.site + url.pathname + url.search + url.hash
            : url.href;
    const resolve = (value: unknown) => {
        try {
            return new URL(String(value), win.location.href);
        } catch {
            return null;
        }
    };

    const open = win.open;
    win.open = ((address?: string | URL) => {
        const url = resolve(address ?? "");
        if (url) post("open-link", { href: onSite(url) });
        return null;
    }) as typeof win.open;

    const click = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0) return;
        const anchor = (event.target as Element | null)?.closest?.("a[href]");
        const address = anchor?.getAttribute("href");
        if (!anchor || !address || address.startsWith("#")) return;
        const url = resolve(address);
        if (!url || !/^https?:$/.test(url.protocol)) return;
        const here = url.origin === frame.world;
        const newTab =
            anchor.getAttribute("target") === "_blank" ||
            event.metaKey ||
            event.ctrlKey;
        // The same page with another fragment is not a way out.
        if (
            here &&
            url.pathname === win.location.pathname &&
            url.search === win.location.search
        )
            return;
        event.preventDefault();
        event.stopPropagation();
        if (here && !newTab)
            post("travel", { href: url.pathname + url.search + url.hash });
        else post("open-link", { href: onSite(url) });
    };
    win.document.addEventListener("click", click, true);

    return () => {
        win.open = open;
        win.document.removeEventListener("click", click, true);
    };
}
