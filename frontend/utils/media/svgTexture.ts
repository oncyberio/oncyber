const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PREVIEW_EDGE = 512;
const MAX_DERIVED_EDGE = 16384;

/** Absolute SVG lengths have intrinsic sizes; percentages and ems do not. */
function intrinsicLength(value: string | null): number | undefined {
    const match = value
        ?.trim()
        .match(
            /^(\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(px|in|cm|mm|q|pt|pc)?$/i
        );
    if (!match) return;
    const units = {
        px: 1,
        in: 96,
        cm: 96 / 2.54,
        mm: 96 / 25.4,
        q: 96 / 101.6,
        pt: 96 / 72,
        pc: 16,
    };
    const pixels = Number(match[1]) * units[match[2]?.toLowerCase() || "px"];
    return Number.isFinite(pixels) && pixels > 0 ? pixels : undefined;
}

/**
 * A viewBox-only SVG can decode into an <img> yet fail texImage2D because
 * it has no intrinsic size. Give those images a bounded raster viewport,
 * retaining the viewBox, aspect ratio, child artwork and SMIL animation.
 */
export function normalizeSvgTextureSource(source: string): string {
    try {
        const document = new DOMParser().parseFromString(
            source,
            "image/svg+xml"
        );
        const svg = document.documentElement;
        if (
            svg.localName !== "svg" ||
            svg.namespaceURI !== SVG_NAMESPACE ||
            document.getElementsByTagName("parsererror").length
        )
            return source;

        // CSS dimensions can override attributes independently, so adding the
        // other dimension could change the authored aspect ratio. Stylesheet
        // rules cannot be resolved reliably in this detached XML document.
        const inlineStyle = (svg.getAttribute("style") || "").replace(
            /\/\*[\s\S]*?\*\//g,
            ""
        );
        if (
            /(?:^|;)\s*(?:width|height)\s*:/i.test(inlineStyle) ||
            inlineStyle.includes("\\") ||
            document.getElementsByTagNameNS("*", "style").length
        )
            return source;

        const width = intrinsicLength(svg.getAttribute("width"));
        const height = intrinsicLength(svg.getAttribute("height"));
        if (width && height) return source;

        const viewBox = svg
            .getAttribute("viewBox")
            ?.trim()
            .split(/[\s,]+/)
            .map(Number);
        if (
            viewBox?.length !== 4 ||
            !viewBox.every(Number.isFinite) ||
            viewBox[2] <= 0 ||
            viewBox[3] <= 0
        )
            return source;

        const aspect = viewBox[2] / viewBox[3];
        if (!Number.isFinite(aspect) || aspect <= 0) return source;

        // Keep a usable authored dimension; only wholly unsized artwork
        // receives the standard 512px preview edge (rather than, e.g., 24px).
        const rasterWidth =
            width ||
            (height
                ? height * aspect
                : Math.max(1, Math.round(PREVIEW_EDGE * Math.min(1, aspect))));
        const rasterHeight =
            height ||
            (width
                ? width / aspect
                : Math.max(1, Math.round(PREVIEW_EDGE / Math.max(1, aspect))));

        // Do not introduce enormous dimensions from pathological metadata.
        if (
            ![rasterWidth, rasterHeight].every(
                (value) =>
                    Number.isFinite(value) &&
                    value > 0 &&
                    value <= MAX_DERIVED_EDGE
            )
        )
            return source;

        if (!width) svg.setAttribute("width", String(rasterWidth));
        if (!height) svg.setAttribute("height", String(rasterHeight));
        return new XMLSerializer().serializeToString(document);
    } catch {
        // Invalid documents still follow the image loader's normal error path.
        return source;
    }
}

export async function prepareSvgTextureBlob(blob: Blob): Promise<Blob> {
    const source = await blob.text();
    const normalized = normalizeSvgTextureSource(source);
    return normalized === source
        ? blob
        : new Blob([normalized], { type: blob.type || "image/svg+xml" });
}
