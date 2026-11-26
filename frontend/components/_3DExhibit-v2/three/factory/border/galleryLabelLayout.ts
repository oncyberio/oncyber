import type { GalleryLabelText } from "./galleryFrame";

export type LabelIcon = "x" | "instagram" | "website";
export type LabelLine = {
    text: string;
    font: string;
    size: number;
    baseline: "alphabetic" | "top";
    x: number;
    y: number;
    color: string;
};
export type LabelLayout = {
    width: number;
    height: number;
    background: string;
    lines: LabelLine[];
    icons: { icon: LabelIcon; x: number; y: number; size: number }[];
};

const SYSTEM_FONT = "'Helvetica Neue', Arial, sans-serif";
const CREDIT_FONT = "'Open Sans', " + SYSTEM_FONT;
export const PLAIN_PLATE_COLOR = "#f3f1ec";

export function layoutGalleryLabel(
    label: GalleryLabelText,
    measure: (font: string, text: string) => number
): LabelLayout {
    const credit = label.credit;
    const width = credit ? 768 : 512;
    const height = credit ? Math.round(768 * 0.58) : 232;
    const background = PLAIN_PLATE_COLOR;
    const lines: LabelLine[] = [];
    const icons: LabelLayout["icons"] = [];
    const pad = credit ? 46 : 34;
    const maxWidth = width - pad * 2;
    const baseline = credit ? "alphabetic" : "top";
    const family = credit ? CREDIT_FONT : SYSTEM_FONT;
    const lineFont = (size: number, weight: number) =>
        `${weight} ${size}px ${family}`;
    const add = (
        text: string,
        font: string,
        size: number,
        x: number,
        y: number,
        color: string
    ) => {
        lines.push({ text, font, size, baseline, x, y, color });
    };
    const fitted = (text: string, font: string, max = maxWidth) =>
        fit(text, max, (value) => measure(font, value));
    const wrapped = (text: string, font: string) =>
        wrap(text, maxWidth, (value) => measure(font, value));
    let y = pad;

    if (!credit) {
        const titleFont = lineFont(40, 600);
        for (const line of wrapped(label.title, titleFont)) {
            add(line, titleFont, 40, pad, y, "#1d1d1d");
            y += 48;
        }
        if (label.artist) {
            const font = lineFont(30, 400);
            add(fitted(label.artist, font), font, 30, pad, y + 10, "#555555");
        }
    } else {
        type Link = { icon: LabelIcon; text: string };
        const socials: Link[] = [];
        if (credit.x) socials.push({ icon: "x", text: "@" + credit.x });
        if (credit.instagram)
            socials.push({ icon: "instagram", text: "@" + credit.instagram });
        const colWidth = (maxWidth - 22) / 2;
        const stack =
            socials.length > 1 &&
            socials.some(
                (link) => measure(lineFont(32, 400), link.text) > colWidth - 46
            );
        const rows: Link[][] = stack
            ? socials.map((link) => [link])
            : socials.length
            ? [socials]
            : [];

        if (credit.website)
            rows.push([{ icon: "website", text: credit.website }]);

        const rowStep = rows.length > 2 ? 44 : 50;
        const firstFooter =
            height - pad + 4 - Math.max(0, rows.length - 1) * rowStep;
        if (credit.artist) {
            const font = lineFont(72, 700);
            y += 62;
            add(fitted(credit.artist, font), font, 72, pad - 3, y, "#111111");
        }
        if (credit.location) {
            const font = lineFont(42, 400);
            y += credit.artist ? 50 : 40;
            add(fitted(credit.location, font), font, 42, pad, y, "#111111");
        }
        if (credit.title) {
            const font = lineFont(42, 700);
            const titleLines = rows.length > 2 && credit.description ? 1 : 2;
            for (const line of wrap(
                credit.title,
                maxWidth,
                (value) => measure(font, value),
                titleLines
            )) {
                y += y === pad ? 40 : 54;
                add(line, font, 42, pad, y, "#111111");
            }
        }
        if (credit.description) {
            const size = 33;
            const font = lineFont(size, 400);
            const start = (y === pad ? pad : y) + 43;
            const last = rows.length ? firstFooter - 40 : height - pad;
            const count = Math.min(2, Math.floor((last - start) / 42) + 1);
            if (count > 0) {
                wrap(
                    credit.description,
                    maxWidth,
                    (v) => measure(font, v),
                    count
                ).forEach((line, i) =>
                    add(line, font, size, pad, start + i * 42, "#41403d")
                );
            }
        }
        rows.forEach((row, i) => {
            const ly = firstFooter + i * rowStep;
            const size = row.length > 1 || rows.length > 2 ? 32 : 36;
            const font = lineFont(size, 400);
            const col = row.length > 1 ? (maxWidth - 22) / 2 : maxWidth;
            row.forEach((link, j) => {
                const x = pad + j * (col + 22);
                icons.push({ icon: link.icon, x, y: ly - 28, size: 30 });
                add(
                    fitted(link.text, font, col - 46),
                    font,
                    size,
                    x + 46,
                    ly,
                    "#222222"
                );
            });
        });
    }
    return { width, height, background, lines, icons };
}

function fit(text: string, max: number, measure: (value: string) => number) {
    if (measure(text) <= max) return text;
    const chars = Array.from(text.normalize("NFC"));
    while (chars.length > 1 && measure(chars.join("") + "…") > max) chars.pop();
    return chars.join("").trimEnd() + "…";
}

function wrap(
    text: string,
    max: number,
    measure: (value: string) => number,
    count = 2
) {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
        const candidate = line ? line + " " + word : word;
        if (measure(candidate) <= max || !line) line = candidate;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    if (lines.length > count)
        return [
            ...lines.slice(0, count - 1),
            lines.slice(count - 1).join(" "),
        ].map((value) => fit(value, max, measure));
    return lines.map((value) => fit(value, max, measure));
}
