import { field, halfSpace, offset } from "../kernel/sdf";
import { skinField } from "../parts/skinField";
import { Rig } from "../rig";
import type { Sculpt, SculptLayer } from "../sculpts/types";
import type { BuildOptions, HumanoidSpec } from "./description";

/**
 * Build a described humanoid as a sculpt: its body from its measurements,
 * its head and hair, and either its outfit or just its underwear.
 */
export function buildHumanoid(
    spec: HumanoidSpec,
    options: BuildOptions = {}
): Sculpt {
    const dressed = options.dressed ?? true;
    // The body is authored straight in the T-pose avatars are animated
    // from, so nothing has to be unposed afterwards.
    const rig = new Rig(spec.proportions, [], { armDrop: 0, elbowBend: 0 });
    const body = skinField(rig, spec.build).body;
    const head = spec.head();
    const hair = spec.hair();
    const outfit = spec.outfit(rig);

    const skin = field().add(head.shape);
    if (dressed)
        // Only what clothes leave showing: nothing under them is drawn.
        skin.add(field().add(body).clip(outfit.uncovered, 0.002), 0.008);
    else skin.add(body, 0.008);
    const layers: SculptLayer[] = [
        {
            material: "skin",
            shape: skin,
            min: dressed ? [-0.92, 1.36, -0.12] : [-0.92, -0.004, -0.17],
            max: dressed ? [0.92, 1.77, 0.14] : [0.92, 1.77, 0.2],
        },
        head.eye,
        hair.layer,
    ];
    if (dressed) layers.push(...outfit.layers);
    else {
        const { waist, hem } = spec.underwear;
        layers.push({
            material: "underwear",
            // Close-fitting shorts: the body's own shape, a little proud
            // of it, between the waistband and the hem.
            shape: field()
                .add(offset(body, 0.0028))
                .clip(halfSpace([0, waist, 0], [0, 1, 0]), 0.002)
                .clip(halfSpace([0, hem, 0], [0, -1, 0]), 0.002),
            min: [-0.22, hem - 0.01, -0.16],
            max: [0.22, waist + 0.01, 0.16],
        });
    }
    return {
        id: spec.id,
        height: spec.height,
        layers,
        hair: { cap: hair.cap, segments: hair.segments },
        face: head.face,
        underwear: spec.underwear,
        badge: outfit.badge,
        buckle: outfit.buckle,
        palette: spec.palette,
    };
}
