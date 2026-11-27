import * as THREE from "three/webgpu";
import type { FigureStyle } from "./style";

/** A number from 0 to 1 that looks unrelated to the two it is made from. */
function chance(seed: number, salt: number) {
    let x = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= Math.imul(salt + 1, 0xc2b2ae35);
    x ^= x >>> 15;
    x = Math.imul(x, 0x2c1b3c6d);
    x ^= x >>> 12;
    x = Math.imul(x, 0x297a2d39);
    x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
}

/** A colour moved in hue, and made more or less vivid and light. */
function shifted(hex: string, hue: number, vivid: number, light: number) {
    const colour = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    colour.getHSL(hsl, THREE.SRGBColorSpace);
    colour.setHSL(
        (((hsl.h + hue) % 1) + 1) % 1,
        Math.min(1, Math.max(0, hsl.s * vivid)),
        Math.min(1, Math.max(0, hsl.l * light)),
        THREE.SRGBColorSpace
    );
    return `#${colour.getHexString()}`;
}

/**
 * The same character a little different: skin a shade lighter or darker,
 * irises and brows another brown, more or less colour in the cheeks,
 * underwear of another colour. Only its look changes, never its shape, so
 * figures varied this way can stand in one crowd. A whole-number `seed`
 * always gives the same variation.
 */
export function variedLook(style: FigureStyle, seed: number): FigureStyle {
    /** From -1 to 1. */
    const swing = (salt: number) => chance(seed, salt) * 2 - 1;
    // Darker skin is kept from turning redder with it.
    const shade = swing(2) * 0.13;
    const skin = [
        swing(0) * 0.008,
        1 + swing(1) * 0.05 + Math.min(0, shade) * 0.8,
        1 + shade,
    ];
    const eyes = [swing(3) * 0.05, 1, 1 + swing(4) * 0.5];
    const hair = 1 + swing(5) * 0.35;
    const cloth = chance(seed, 6);
    return {
        ...style,
        skin: {
            ...style.skin,
            tone: shifted(style.skin.tone, skin[0], skin[1], skin[2]),
            blush: shifted(
                style.skin.blush,
                skin[0],
                skin[1],
                (1 + skin[2]) / 2
            ),
            flush: Math.min(
                1,
                style.skin.flush * (0.8 + chance(seed, 7) * 0.5)
            ),
            sheen: Math.min(
                1,
                style.skin.sheen * (0.7 + chance(seed, 8) * 0.6)
            ),
        },
        eyes: {
            ...style.eyes,
            iris: shifted(style.eyes.iris, eyes[0], eyes[1], eyes[2]),
            irisLight: shifted(
                style.eyes.irisLight,
                eyes[0],
                eyes[1],
                (1 + eyes[2]) / 2
            ),
        },
        lids: {
            ...style.lids,
            colour: shifted(style.lids.colour, 0, 1, (1 + hair) / 2),
        },
        brows: {
            ...style.brows,
            colour: shifted(style.brows.colour, 0, 1, hair),
        },
        mouth: {
            ...style.mouth,
            lipTint: Math.min(
                1,
                style.mouth.lipTint * (0.8 + chance(seed, 9) * 0.4)
            ),
        },
        underwear: {
            ...style.underwear,
            colour: shifted(style.underwear.colour, cloth, 1, 1),
            band: shifted(style.underwear.band, cloth, 1, 1),
        },
    };
}
