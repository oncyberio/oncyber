import * as N from "three/tsl";
import {
    streetSkinTile,
    streetEyeTile,
    streetHairTile,
    streetClothTile,
} from "./streetBrush";
import { coatShadowUV, garmentInk } from "./garmentPrint";

/** The integer part of U identifies the finish or printed fabric.
 * Suppress subpixel marks as the avatar recedes to avoid shimmering in crowds. */
export const finish = { enamel: 0, skin: 1, fiber: 2, cloth: 3 } as const;
export const coatUVBase = 43;
export const streetFaceUVBase = 50;
// Both crease tiles retain the skin finish in their low three bits.
export const creaseUVBase = 41,
    frontalCreaseUVBase = 49;
// Eye coordinates are measured in pupil radii in the character's frontal plane.
export const pupilUVBase = 128;
export const insetPupilUVBase = 256;
export type Finish = (typeof finish)[keyof typeof finish];
export function cornealNormal() {
    const oct = N.attribute("color", "vec3").xz.sub(0.5).div(0.44);
    const z = N.float(1).sub(N.abs(oct.x)).sub(N.abs(oct.y));
    const fold = N.max(0, z.negate());
    return N.vec3(oct.sub(N.sign(oct).mul(fold)), z).normalize();
}
export function portraitDirection() {
    const drawn = N.uv()
        .x.greaterThanEqual(insetPupilUVBase)
        .and(N.uv().y.greaterThanEqual(2));
    return N.select(
        N.uv().x.lessThan(64).or(drawn),
        N.vec3(1, 0, 0),
        cornealNormal()
    );
}
type Direction = ReturnType<typeof N.transformNormalToView>;
export function surfaceGrain(
    toView?: (n: Direction) => Direction,
    streetBrushes = false
) {
    const uv = N.uv();
    const coat = uv.x
        .greaterThanEqual(coatUVBase)
        .and(uv.x.lessThan(coatUVBase + 1));
    const orbSurface = uv.x.lessThan(-48);
    const paintedOrb = uv.x.lessThan(-76);
    const orbU = uv.x.add(N.select(paintedOrb, 16, 0));
    const contactOrb = orbU.lessThan(-68);
    const penOutline = uv.x.lessThan(-16).and(orbSurface.not());
    const st = N.vec2(
        N.select(
            orbSurface,
            orbU.add(N.select(contactOrb, 72, 64)),
            N.select(
                penOutline,
                uv.x.add(48),
                N.select(coat, uv.x.sub(coatUVBase - 19), uv.x)
            )
        ),
        N.select(contactOrb, uv.y.mul(0.1).add(0.5), uv.y)
    );
    const sculpted = st.x.greaterThanEqual(24);
    const frontal = st.x
        .greaterThanEqual(frontalCreaseUVBase)
        .and(st.x.lessThan(frontalCreaseUVBase + 1));
    const crease = st.x
        .greaterThanEqual(creaseUVBase)
        .and(st.x.lessThan(creaseUVBase + 1))
        .or(frontal);
    const inkedPortrait = st.x.greaterThanEqual(56).and(st.x.lessThan(64));
    const portraitSkin = st.x
        .greaterThanEqual(32)
        .and(st.x.lessThan(40))
        .or(crease)
        .or(inkedPortrait.and(st.x.lessThan(58)));
    const sourcePaint = st.x.greaterThanEqual(16).and(st.x.lessThan(24));
    const illustrated = st.x.greaterThanEqual(8).and(st.x.lessThan(16));
    const slot = N.mod(N.floor(st.x), 8);
    const printed = slot.equal(4).or(slot.equal(6)).or(slot.equal(7));
    const kind = N.select(
        slot.equal(6),
        N.float(0),
        N.select(slot.equal(7), N.float(1), N.min(3, slot))
    );
    const u = N.fract(st.x),
        v = st.y;
    const cell = N.floor(u.mul(160))
        .mul(23.13)
        .add(N.floor(v.mul(160)).mul(47.17));
    const grain = N.fract(N.sin(cell).mul(17437.31)).sub(0.5);
    const visible = N.float(1).sub(
        N.smoothstep(0.002, 0.012, N.fwidth(st.x).add(N.fwidth(st.y)))
    );
    const strand = N.cos(u.mul(270).add(N.sin(v.mul(9)).mul(2.5)));
    const weave = N.cos(u.mul(250)).mul(N.cos(v.mul(250)));
    const micro = N.mix(
        grain.mul(0.037),
        strand
            .mul(
                N.select(illustrated.or(sourcePaint).or(sculpted), 0.014, 0.055)
            )
            .add(grain.mul(0.05)),
        N.smoothstep(1.4, 1.6, kind)
    );
    const texture = N.mix(
        micro,
        weave.mul(0.05).add(grain.mul(0.04)),
        N.smoothstep(2.4, 2.6, kind)
    );
    const wash = N.sin(u.mul(16).add(N.sin(v.mul(8))))
        .mul(N.cos(v.mul(12)))
        .mul(0.009);
    const incidence = N.abs(N.normalView.z);
    const softRim = N.smoothstep(0, 0.27, N.abs(N.normalView.z))
        .mul(0.38)
        .add(0.62);
    const inkEdge = N.smoothstep(0.015, 0.235, incidence).mul(0.84).add(0.16);
    const rim = N.select(
        sourcePaint,
        N.smoothstep(0.015, 0.36, incidence).mul(0.087).add(0.913),
        N.select(
            illustrated,
            inkEdge,
            N.select(
                sculpted.and(kind.equal(0)),
                N.smoothstep(0.015, 0.16, incidence).mul(0.68).add(0.32),
                N.select(
                    sculpted.and(kind.equal(1).or(kind.equal(2))),
                    N.smoothstep(0.01, 0.23, incidence).mul(0.53).add(0.47),
                    softRim
                )
            )
        )
    );
    const portraitEdge = N.smoothstep(0.055, 0.21, incidence)
        .mul(0.77)
        .add(0.23);
    // On a convex surface, squared incidence is locally proportional to
    // screen distance from the tangent. Its derivative keeps the pen narrow
    // on the temple, jaw and pinna as the camera turns.
    const cosineSquared = incidence.mul(incidence);
    const distancePixels = cosineSquared.div(
        N.max(N.fwidth(cosineSquared), 0.0001)
    );
    const pen = N.smoothstep(0.15, 1.6, distancePixels).mul(0.97).add(0.03);
    const outline = N.select(
        portraitSkin.or(sculpted.and(slot.equal(2))),
        N.select(inkedPortrait, portraitEdge.mul(pen), portraitEdge),
        N.float(1)
    );
    const grainLight = N.vec3(
        N.float(1)
            .add(
                wash
                    .add(texture.mul(visible))
                    .mul(N.smoothstep(0.4, 0.6, N.abs(kind)))
            )
            .mul(rim)
            .mul(outline)
    );
    // The engine multiplies colorNode by linear vertex paint after this step.
    // The ink replaces the fabric pigment while keeping its modeled lighting.
    // Fold at each vertex before interpolation. The welded seam goes from 1
    // to 0 along the lining and both endpoints must sample the same clear ink.
    const acrossCoat = N.abs(uv.y.mul(2).sub(1)).mul(
        N.mix(1.12, 0.86, N.smoothstep(0.42, 0.62, uv.y))
    );
    const coatSample = N.varying(
        N.vec2(N.min(acrossCoat, 1), u)
            .mul(N.vec2(...coatShadowUV.span))
            .add(N.vec2(...coatShadowUV.origin))
    );
    const ink = N.texture(
        garmentInk,
        N.select(coat, coatSample, N.vec2(u, st.y))
    );
    const dye = N.vertexColor().rgb;
    const inkLight = N.smoothstep(-0.6, 1, N.normalView.y).mul(0.16).add(0.84);
    const pigment = N.mix(
        N.vec3(1),
        ink.rgb.mul(inkLight).div(N.max(dye, 0.00001)),
        ink.a
    );
    const shade = N.float(1).sub(
        N.smoothstep(
            -0.48,
            0.36,
            N.dot(N.normalView, N.vec3(-0.44, 0.52, 0.73))
        )
    );
    const skin = N.float(1).sub(N.smoothstep(0.12, 0.45, N.abs(kind.sub(1))));
    const bounce = N.vec3(1).sub(
        N.vec3(0.095, 0.16, 0.13)
            .mul(shade)
            .mul(skin)
            .mul(N.select(sourcePaint, 0.48, 1))
    );
    const lining = N.select(
        slot.equal(5).and(N.frontFacing.not()),
        N.vec3(0.56, 0.49, 0.43),
        N.vec3(1)
    );
    // Broad key light reveals the cheek, eye dome and garment curvature even
    // in unlit worlds. Keep the light inside this same crowd material/pass.
    const oriented = N.select(
        N.normalView.z.lessThan(0),
        N.normalView.negate(),
        N.normalView
    );
    const key = N.smoothstep(
        -0.24,
        0.93,
        N.dot(oriented, N.vec3(-0.52, 0.57, 0.63))
    );
    const modeling = N.mix(
        N.vec3(0.7, 0.63, 0.64),
        N.vec3(1.09, 1.06, 1.02),
        key
    );
    const fiber = slot.equal(2);
    const sheen = N.smoothstep(
        0.76,
        0.985,
        N.dot(oriented, N.vec3(-0.4, 0.46, 0.79))
    ).mul(0.011);
    const fiberLight = N.select(
        fiber,
        N.vec3(sheen).div(N.max(dye, 0.025)),
        N.vec3(0)
    );
    const orbKey = N.dot(oriented, N.vec3(-0.47, 0.64, 0.61));
    const orbLight = N.smoothstep(-0.4, 0.94, orbKey)
        .mul(0.39)
        .add(0.73)
        .add(
            N.smoothstep(0.73, 0.992, orbKey).mul(0.048).div(N.max(dye, 0.09))
        );
    const lensShadow = N.float(1).sub(
        N.float(1)
            .sub(N.smoothstep(0, 1, N.abs(uv.y)))
            .mul(N.fract(st.x).sub(0.005).div(0.99))
    );
    const surface = grainLight
        .mul(N.select(contactOrb, lensShadow, 1))
        .mul(N.select(orbSurface.and(paintedOrb.not()), orbLight, N.vec3(1)))
        .mul(
            N.select(
                sculpted,
                N.select(
                    kind.equal(0),
                    N.mix(N.vec3(1), modeling, 0.56),
                    N.select(
                        portraitSkin,
                        N.mix(N.vec3(1), modeling, 0.42),
                        modeling.add(fiberLight)
                    )
                ),
                N.vec3(1)
            )
        )
        .mul(N.select(portraitSkin, N.mix(N.vec3(1), bounce, 0.62), bounce))
        .mul(
            N.select(
                penOutline,
                N.select(
                    sculpted,
                    // A drawn garment has a continuous dark edge even where a
                    // broad, low-poly panel has an almost constant normal.
                    N.min(
                        N.smoothstep(0.7, 3.25, distancePixels),
                        N.smoothstep(0.22, 0.52, incidence)
                    )
                        .mul(0.985)
                        .add(0.015),
                    N.smoothstep(0.12, 1.35, distancePixels)
                        .mul(0.875)
                        .add(0.125)
                ),
                1
            )
        )
        .mul(lining)
        .mul(N.select(printed.or(coat), pigment, N.vec3(1)));
    const inset = st.x.greaterThanEqual(insetPupilUVBase);
    // Interpolate the skinned 3D offset before measuring distance to the view
    // ray. The globe and lids clip the round pigment at their real silhouettes.
    const fromPupil = N.varying(
        N.transformNormalToView(N.normalLocal)
            .normalize()
            .mul(N.max(0, st.x.sub(insetPupilUVBase)))
    );
    const radius = N.select(
        inset,
        N.length(N.cross(fromPupil, N.positionViewDirection)),
        N.length(N.vec2(st.x.sub(pupilUVBase), st.y))
    );
    const aa = N.max(N.fwidth(radius).mul(0.52), 0.012);
    const paper = N.smoothstep(N.float(1).sub(aa), N.float(1).add(aa), radius);
    const tracedInk = inset.and(st.y.greaterThanEqual(2));
    const inkCode = N.max(0, N.floor(st.y).sub(2));
    const rgb4 = N.vec3(
        N.mod(N.floor(inkCode.div(256)), 16),
        N.mod(N.floor(inkCode.div(16)), 16),
        N.mod(inkCode, 16)
    ).div(15);
    const whiteLight = N.select(tracedInk, N.float(0.82), st.y);
    const white = N.mix(
        N.vec3(0.81, 0.83, 0.82),
        N.vec3(1.0, 0.99, 0.96),
        N.select(inset, whiteLight, key)
    );
    // The red and green channels on the white store clearance from the skull
    // and lids. Their ink stays attached to the socket as it turns. A fine
    // grazing edge continues the line around the exposed part of the globe.
    const contact = N.smoothstep(0.489, 0.523, dye.r);
    const lid = N.smoothstep(0.257, 0.283, dye.g);
    const contour = N.smoothstep(0.16, 0.32, incidence);
    // Keep the traced lid margin legible as its projection narrows on a turn.
    const rimDistance = dye.g.sub(0.5);
    const pixel = N.max(N.fwidth(rimDistance), 0.0001);
    const stroke = N.max(0.012, pixel.mul(0.55));
    const rimInk = N.smoothstep(
        stroke.sub(pixel.mul(0.5)),
        stroke.add(pixel.mul(0.5)),
        rimDistance
    );
    // At oblique angles a rounded globe can hide its own stitched rim. Ink
    // the apparent contour where the true, skinned corneal normal grazes the ray.
    let eyeContour: Direction = rimInk;
    const direction =
        toView &&
        N.varying(toView(portraitDirection()).normalize()).normalize();
    const facing = direction
        ? N.dot(direction, N.positionViewDirection)
        : N.float(0);
    if (direction) {
        const edgePixels = N.abs(facing).div(N.max(N.fwidth(facing), 0.0001));
        const brush = N.clamp(N.float(0.24).div(aa.mul(2)), 0.62, 3.2);
        const silhouette = N.smoothstep(
            brush.sub(0.5),
            brush.add(0.5),
            edgePixels
        );
        eyeContour = N.select(
            dye.b.lessThan(0.96),
            N.min(rimInk, silhouette),
            rimInk
        );
        const turn = N.abs(facing);
        const quarter = N.select(facing.lessThan(0), dye.g, dye.r);
        const frontalU = N.vertexColor().a;
        const angled = N.mix(frontalU, quarter, N.smoothstep(0, 0.57358, turn));
        const sideU = N.select(
            facing.lessThan(0),
            dye.b,
            N.float(1).sub(dye.b)
        );
        const horizontal = N.mix(angled, sideU, N.smoothstep(0.57358, 1, turn));
        const vertical = N.varying(N.fract(st.y));
        const edgeClearance = (u) =>
            N.min(u.sub(0.1), N.float(0.9).sub(u)).div(
                N.max(0.00001, N.length(N.vec2(N.dFdx(u), N.dFdy(u))))
            );
        const distance = N.min(
            edgeClearance(horizontal),
            edgeClearance(vertical)
        );
        const weight = N.floor(inkCode.div(4096)).div(512);
        const eyeHeight = N.float(0.8).div(
            N.max(0.0001, N.length(N.vec2(N.dFdx(vertical), N.dFdy(vertical))))
        );
        const strokeWidth = N.clamp(weight.mul(eyeHeight), 0.65, 6);
        const drawn = N.smoothstep(
            strokeWidth.sub(0.5),
            strokeWidth.add(0.5),
            distance
        );
        eyeContour = N.select(tracedInk, drawn, eyeContour);
    }
    // A lateral extension of the ink fades around the far cheek.
    const end = N.smoothstep(0.18, 0.45, N.abs(u.sub(0.5)));
    const anatomical = N.mix(
        N.float(1),
        N.smoothstep(0.1, 0.5, incidence),
        end
    );
    const extension = N.smoothstep(0.28, 0.47, N.abs(u.sub(0.5)));
    const lateral = N.smoothstep(0.04, 0.5, N.sign(u.sub(0.5)).mul(facing));
    const coverage = anatomical.mul(N.mix(N.float(1), lateral, extension));
    const width = N.abs(v.mul(2).sub(1));
    const aaInk = N.clamp(N.fwidth(v), 0.05, 0.42);
    // Side-specific nose strokes follow the visible wing as the head turns.
    // Distances from the middle of this skin tile distinguish the resting
    // stroke from its oblique counterpart. The centre keeps a single stroke.
    const offset = u.sub(0.5);
    const towardsWing = N.sign(offset).mul(facing.negate());
    const switched = N.select(
        N.abs(offset).greaterThan(0.25),
        N.float(1).sub(N.smoothstep(0.06, 0.35, towardsWing.negate())),
        N.smoothstep(0.18, 0.49, towardsWing)
    ).mul(N.float(1).sub(N.smoothstep(0.69, 0.97, N.abs(facing))));
    const viewCoverage = N.select(
        frontal,
        N.select(
            N.abs(offset).greaterThan(0.12),
            switched,
            N.float(1).sub(N.smoothstep(0.3, 0.93, N.abs(facing)))
        ),
        coverage
    );
    const creaseInk = viewCoverage.mul(
        N.float(1).sub(
            N.smoothstep(
                coverage.mul(0.85).sub(aaInk),
                coverage.mul(0.85).add(aaInk),
                width
            )
        )
    );
    const creasePigment = N.mix(
        N.vec3(1),
        N.vec3(0.018, 0.022, 0.032),
        creaseInk
    );
    const opening = N.select(
        inset,
        eyeContour,
        N.min(contact, N.min(lid, contour))
    );
    const outlineColor = N.select(
        tracedInk,
        rgb4.mul(rgb4),
        N.vec3(0.078, 0.056, 0.045)
    );
    const enamel = N.mix(outlineColor, white, opening);
    const eye = N.mix(N.vec3(0.013, 0.011, 0.01), enamel, paper);
    // The optional scientist eye line follows the actual globe silhouette
    // through a turn. Its width stays antialiased at both crowd and portrait scale.
    const strokeWhite = N.mix(
        N.vec3(0.9, 0.9, 0.88),
        N.vec3(1, 0.99, 0.97),
        key
    );
    const outlinedGlobe = N.mix(
        dye,
        strokeWhite,
        N.smoothstep(0.25, 1.35, distancePixels)
    );
    // The fitted front and profile contours belong to the same curved skull.
    // Distances in the existing UV channel preserve the drawn line weight at
    // either authored view without projecting a nose stroke down the frontal face.
    const turn = N.abs(facing);
    const frontDistance = N.fract(uv.x).mul(128);
    const brush = (distance: typeof uv.y, width: number) => {
        const aa = N.max(0.25, N.fwidth(distance).mul(0.6));
        return N.float(1).sub(
            N.smoothstep(
                N.float(width).sub(aa),
                N.float(width).add(aa),
                distance
            )
        );
    };
    const jawInk = brush(frontDistance, 1.48).mul(
        N.float(1).sub(N.smoothstep(0.14, 0.68, turn))
    );
    const noseInk = brush(uv.y, 1.24).mul(N.smoothstep(0.6, 0.96, turn));
    // Between the registered views, continue the jaw on its actual tangent.
    const quarterInk = N.float(1)
        .sub(N.smoothstep(0.05, 0.26, incidence))
        .mul(N.float(1).sub(N.smoothstep(2.0, 12.0, frontDistance)))
        .mul(N.smoothstep(0.18, 0.48, turn))
        .mul(N.float(1).sub(N.smoothstep(0.73, 0.97, turn)));
    const outlineAmount = N.max(quarterInk, N.max(jawInk, noseInk));
    const faceLight = N.mix(
        N.vec3(1),
        N.vec3(0.031, 0.024, 0.02),
        outlineAmount
    );
    let finishLight = N.select(crease, surface.mul(creasePigment), surface);
    if (streetBrushes) {
        // Resolve chart IDs on the vertices. MSAA can extrapolate a UV outside
        // a narrow fringe triangle at the edge of a covered pixel.
        const tile = N.round(N.varying(N.floor(N.uv().x)));
        // Paint the broad shadow and light planes in the model's bind
        // frame. The palette stays anchored to the figure during a camera turn.
        const formNormal = N.varying(N.attribute("normal", "vec3")).normalize();
        const light = N.dot(formNormal, N.vec3(-0.46, 0.68, 0.57));
        const feather = N.max(0.09, N.fwidth(light));
        const tone = (threshold: number) =>
            N.smoothstep(
                N.float(threshold).sub(feather),
                N.float(threshold).add(feather),
                light
            );
        const cel = tone(0.04)
            .mul(0.62)
            .add(tone(0.56).mul(0.25))
            .add(light.mul(0.065))
            .add(0.09);
        const skinLight = ink.rgb
            .div(N.vec3(0.98225, 0.68669, 0.46778))
            .mul(
                N.mix(
                    N.vec3(0.87, 0.78, 0.71),
                    N.vec3(1.03, 1.025, 1.01),
                    N.smoothstep(-0.55, 0.82, light)
                )
            );
        const irisTint = N.smoothstep(0.008, 0.045, ink.b.sub(ink.r));
        const enamelLight = ink.rgb
            .mul(
                N.mix(
                    N.vec3(1),
                    dye.div(N.vec3(0.05127, 0.1912, 0.31855)),
                    irisTint
                )
            )
            .div(N.max(dye, 0.00001));
        // Local U follows the strand and is continuous along each shaped lock.
        const mode = N.round(N.varying(N.floor(N.uv().y)));
        const down = N.clamp(uv.y.sub(mode), 0, 1);
        const hairU = N.clamp(uv.x.sub(tile), 0, 1);
        const dome = mode.equal(4);
        const tongue = mode.equal(5);
        const warp = N.select(dome, hairU.mul(8), hairU).add(
            N.sin(down.mul(5.1)).mul(0.035)
        );
        const wave = N.cos(warp.sub(0.47).mul(6.283)).mul(0.5).add(0.5);
        const fine = N.cos(warp.mul(31.41).add(N.sin(down.mul(7)).mul(0.6)))
            .mul(0.5)
            .add(0.5);
        const broad = N.mix(
            N.vec3(0.79, 0.6, 0.42),
            N.vec3(1.05, 1.035, 1.015),
            wave.mul(0.49).add(fine.mul(0.12)).add(cel.mul(0.39))
        );
        const edgeDistance = N.min(hairU, N.float(1).sub(hairU));
        const freeTip = N.select(
            mode.equal(0).or(dome),
            N.float(0),
            N.select(
                mode.equal(2),
                N.smoothstep(0.23, 0.62, down).mul(0.3),
                N.select(
                    tongue,
                    N.smoothstep(0.12, 0.8, down).mul(0.24),
                    N.float(0.55)
                )
            )
        );
        const strandEdge = N.float(1)
            .sub(
                N.smoothstep(
                    0.0,
                    N.select(
                        mode.equal(1),
                        N.float(0.16),
                        N.select(tongue, N.float(0.15), N.float(0.064))
                    ),
                    edgeDistance
                )
            )
            .mul(freeTip);

        const crown = N.mix(
            N.vec3(1.015, 1.002, 0.97),
            broad,
            N.select(
                dome,
                N.float(0.32).mul(N.float(1).sub(N.smoothstep(0.48, 1, down))),
                N.smoothstep(0.03, 0.9, down).mul(0.73)
            )
        ).mul(N.mix(N.vec3(0.95, 0.88, 0.77), N.vec3(1.02, 1.014, 1), cel));
        const strandLight = N.mix(
            N.select(
                mode.equal(0).or(dome).or(tongue),
                crown,
                N.select(
                    mode.equal(2),
                    N.mix(
                        N.vec3(0.99, 0.965, 0.91),
                        broad.mul(
                            N.mix(
                                N.vec3(0.73, 0.58, 0.45),
                                N.vec3(1.03, 0.97, 0.88),
                                wave
                            )
                        ),
                        N.smoothstep(0.07, 0.38, down)
                    ),
                    broad
                )
            ),
            N.vec3(0.082, 0.046, 0.027),
            strandEdge
        );

        const familyLight = N.select(
            tile.equal(streetSkinTile),
            skinLight,
            N.select(
                tile.equal(streetEyeTile),
                enamelLight,
                strandLight.mul(
                    N.select(
                        mode.equal(3),
                        N.mix(
                            N.vec3(0.8, 0.66, 0.51),
                            N.vec3(1.04, 1.028, 1.013),
                            N.smoothstep(0.0, 0.68, down)
                                .mul(0.43)
                                .add(cel.mul(0.57))
                        ),
                        N.vec3(1)
                    )
                )
            )
        );
        finishLight = N.select(
            tile
                .greaterThanEqual(streetSkinTile)
                .and(tile.lessThanEqual(streetHairTile)),
            familyLight,
            N.select(
                tile.equal(streetClothTile),
                ink.rgb
                    .div(0.21586)
                    .mul(
                        N.mix(
                            N.vec3(0.85, 0.83, 0.84),
                            N.vec3(1.07, 1.06, 1.04),
                            cel
                        )
                    ),
                finishLight
            )
        );
    }
    return N.select(
        st.x.lessThan(0),
        outlinedGlobe.div(N.max(dye, 0.00001)),
        N.select(
            st.x.greaterThan(64),
            eye.div(N.max(dye, 0.00001)),
            N.select(
                N.floor(uv.x).equal(streetFaceUVBase),
                faceLight,
                finishLight
            )
        )
    );
}
