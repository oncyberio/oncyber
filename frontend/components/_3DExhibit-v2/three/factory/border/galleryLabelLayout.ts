import { LABEL_DEPTH, type GalleryLabelText } from "./galleryFrame";

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
    let height: number;
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
    let y = credit ? 39 : 29;

    if (!credit) {
        const titleFont = lineFont(40, 600);
        let bottom = y;
        for (const line of wrapped(label.title, titleFont)) {
            add(line, titleFont, 40, pad, y, "#1d1d1d");
            bottom = y + 40;
            y += 48;
        }
        if (label.artist) {
            const font = lineFont(30, 400);
            add(fitted(label.artist, font), font, 30, pad, y + 5, "#555555");
            bottom = y + 35;
        }
        height = Math.max(110, bottom + 28);
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

        let hasText = false;
        if (credit.artist) {
            const font = lineFont(58, 700);
            y += 52;
            add(fitted(credit.artist, font), font, 58, pad, y, "#111111");
            hasText = true;
        }
        if (credit.location) {
            const font = lineFont(38, 400);
            y += 46;
            add(fitted(credit.location, font), font, 38, pad, y, "#41403d");
            hasText = true;
        }
        if (credit.title) {
            const font = lineFont(44, 400);
            for (const line of wrapped(credit.title, font)) {
                y += 50;
                add(line, font, 44, pad, y, "#111111");
            }
            hasText = true;
        }
        if (credit.description) {
            const size = 33;
            const font = lineFont(size, 400);
            for (const line of wrap(credit.description, maxWidth, (v) =>
                measure(font, v)
            )) {
                y += 41;
                add(line, font, size, pad, y, "#41403d");
            }
            hasText = true;
        }
        const firstFooter = y + (hasText ? 57 : 38);
        rows.forEach((row, i) => {
            const ly = firstFooter + i * 42;
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
        const bottom = rows.length ? firstFooter + (rows.length - 1) * 42 : y;
        const naturalHeight = bottom + 40;
        height = Math.max(226, naturalHeight);
        // A two-line label still has physical margins, but no empty footer.
        const shift = (height - naturalHeight) / 2;
        if (shift) {
            for (const line of lines) line.y += shift;
            for (const icon of icons) icon.y += shift;
        }
    }
    return { width, height, background, lines, icons };
}

/** Match the face to the measured lines without moving its bottom or wall plane. */
export function fitPlacardRect<
    T extends { x: number; y: number; z: number; w: number; h: number }
>(rect: T, layout: Pick<LabelLayout, "width" | "height">): T {
    const h = (rect.w * layout.height) / layout.width;
    const change = h - rect.h;
    return {
        ...rect,
        h,
        y: rect.y + change / 2,
        z: rect.z + change * LABEL_DEPTH,
    };
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
