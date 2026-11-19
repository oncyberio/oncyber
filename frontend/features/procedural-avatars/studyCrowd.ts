import { readAvatarFile } from "./avatarFile";

/** Vary actual geometry and fabric on the eight frozen drawings. Parse a fresh
 * source for each placement so the display also exercises the normal reader. */
export function studyCrowdMember(source: string, index: number) {
    const file = JSON.parse(source);
    const channels = [
        ((73 + 37 * index) % 190) + 30,
        ((41 + 13 * index) % 160) + 60,
        ((101 + 17 * index) % 180) + 50,
    ];
    const color =
        "#" + channels.map((n) => n.toString(16).padStart(2, "0")).join("");
    if (file.construction === "household") {
        file.design.head[0] *= 0.9 + index * 0.002;
        file.design.outfit.color = color;
    } else {
        file.paints.shirt = color;
        file.proportions.headWidth = 0.84 + index * 0.003;
        file.proportions.crownLength = 0.55 + (index % 97) / 96;
    }
    return readAvatarFile(file).recipe;
}
