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

/** A file a world asks the page to save, as the page will offer it. */
export interface WorldFile {
    name: string;
    file: Blob;
}

const MAX_FILE_BYTES = 60 * 1024 * 1024;

/** A file from a world's `download`, or null: a picture, a film or data. */
export function readWorldFile(message: any): WorldFile | null {
    const file = message?.file;
    if (
        typeof Blob === "undefined" ||
        !(file instanceof Blob) ||
        !file.size ||
        file.size > MAX_FILE_BYTES ||
        !/^(image\/(png|jpeg|webp)|video\/(mp4|webm)|application\/json|model\/gltf-binary)$/.test(
            file.type
        )
    )
        return null;
    // A plain file name: no folders, nothing the system reads as a path.
    const name =
        (typeof message.name === "string" ? message.name : "")
            .replace(/[^A-Za-z0-9 ._()-]/g, "")
            .replace(/^\.+/, "")
            .slice(0, 80) || "oncyber";
    return { name, file };
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

    // A file the world made and wants saved (a photo of the scene): a
    // frame cannot save one, so it is handed to the page, which offers it.
    const made = (anchor: HTMLAnchorElement) =>
        anchor.hasAttribute("download") && /^(data|blob):/.test(anchor.href);
    const save = (anchor: HTMLAnchorElement) => {
        const name = anchor.getAttribute("download") || "";
        void win
            .fetch(anchor.href)
            .then((response) => response.blob())
            .then((file) => post("download", { name, file }))
            .catch(() => {});
    };
    const saveClick = (event: MouseEvent) => {
        const anchor = (event.target as Element | null)?.closest?.(
            "a[download]"
        ) as HTMLAnchorElement | null;
        if (!anchor || !made(anchor)) return;
        event.preventDefault();
        event.stopPropagation();
        save(anchor);
    };
    win.document.addEventListener("click", saveClick, true);
    // Code presses a link it never put in the page; no click event passes
    // the document then.
    const Anchor = (win as any).HTMLAnchorElement as
        | typeof HTMLAnchorElement
        | undefined;
    const press = Anchor?.prototype.click;
    if (Anchor && press)
        Anchor.prototype.click = function (this: HTMLAnchorElement) {
            if (!this.isConnected && made(this)) save(this);
            else press.call(this);
        };

    return () => {
        win.open = open;
        win.document.removeEventListener("click", click, true);
        win.document.removeEventListener("click", saveClick, true);
        if (Anchor && press) Anchor.prototype.click = press;
    };
}
