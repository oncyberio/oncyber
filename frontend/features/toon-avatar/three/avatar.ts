import {
    Bone,
    BufferAttribute,
    BufferGeometry,
    Group,
    Skeleton,
    SkinnedMesh,
    Sphere,
    Vector3,
} from "three";
import { faceParams, type ToonExpression } from "../face";
import { buildToonMesh, type ToonMesh } from "../mesh";
import { normalizeRecipe, type ToonAvatarRecipe } from "../recipe";
import {
    TOON_BONES,
    TOON_BONE_PARENT,
    type ToonBone,
    type ToonLayout,
} from "../skeleton";
import {
    applyExpression,
    applyFaceParams,
    createToonMaterials,
    createToonUniforms,
    type ToonUniforms,
} from "./material";

function toGeometry(mesh: ToonMesh): BufferGeometry {
    const source = mesh.geometry;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(source.position, 3));
    geometry.setAttribute("normal", new BufferAttribute(source.normal, 3));
    geometry.setAttribute("color", new BufferAttribute(source.color, 3));
    geometry.setAttribute(
        "skinIndex",
        new BufferAttribute(source.skinIndex, 4)
    );
    geometry.setAttribute(
        "skinWeight",
        new BufferAttribute(source.skinWeight, 4)
    );
    geometry.setAttribute("paint", new BufferAttribute(source.paint, 4));
    geometry.setIndex(new BufferAttribute(source.index, 1));
    const center = new Vector3(
        (source.min[0] + source.max[0]) / 2,
        (source.min[1] + source.max[1]) / 2,
        (source.min[2] + source.max[2]) / 2
    );
    // Generous: limbs swing well outside the rest pose.
    geometry.boundingSphere = new Sphere(
        center,
        new Vector3(...source.max).distanceTo(center) * 1.6
    );
    return geometry;
}

/**
 * A toon avatar in a three.js scene: one skeleton, one geometry, drawn twice
 * (colour, then ink). Built from a recipe; `setRecipe` rebuilds it in place,
 * so whatever animates the bones carries on undisturbed.
 */
export class ToonAvatar {
    readonly root = new Group();
    readonly bones = {} as Record<ToonBone, Bone>;
    readonly skeleton: Skeleton;
    readonly uniforms: ToonUniforms = createToonUniforms();
    readonly mesh: SkinnedMesh;
    readonly outline: SkinnedMesh;
    recipe!: ToonAvatarRecipe;
    layout!: ToonLayout;

    private materials = createToonMaterials(this.uniforms);

    constructor(recipe?: unknown) {
        this.root.name = "ToonAvatar";
        for (const name of TOON_BONES) {
            const bone = new Bone();
            bone.name = name;
            this.bones[name] = bone;
        }
        for (const name of TOON_BONES) {
            const parent = TOON_BONE_PARENT[name];
            if (parent) this.bones[parent].add(this.bones[name]);
        }
        this.root.add(this.bones.hips);
        this.skeleton = new Skeleton(
            TOON_BONES.map((name) => this.bones[name])
        );

        const empty = new BufferGeometry();
        this.mesh = new SkinnedMesh(empty, this.materials.fill);
        this.outline = new SkinnedMesh(empty, this.materials.ink);
        this.mesh.name = "ToonAvatarBody";
        this.outline.name = "ToonAvatarInk";
        for (const mesh of [this.mesh, this.outline]) {
            mesh.frustumCulled = true;
            this.root.add(mesh);
        }
        this.setRecipe(recipe);
    }

    /** Standing height in metres, to the top of the skull. */
    get height() {
        return this.layout.height;
    }

    setRecipe(input: unknown) {
        const built = buildToonMesh(normalizeRecipe(input));
        this.recipe = built.recipe;
        this.layout = built.layout;

        // Put every bone back at rest for the new proportions, then rebind.
        for (const name of TOON_BONES) {
            const bone = this.bones[name];
            const parent = TOON_BONE_PARENT[name];
            const at = built.layout.joints[name];
            const from = parent ? built.layout.joints[parent] : [0, 0, 0];
            bone.position.set(
                at[0] - from[0],
                at[1] - from[1],
                at[2] - from[2]
            );
            bone.quaternion.identity();
            bone.scale.set(1, 1, 1);
        }
        this.root.updateMatrixWorld(true);
        this.skeleton.calculateInverses();

        const geometry = toGeometry(built);
        const previous = this.mesh.geometry;
        for (const mesh of [this.mesh, this.outline]) {
            mesh.geometry = geometry;
            mesh.bind(this.skeleton, mesh.matrixWorld);
        }
        previous.dispose();

        applyFaceParams(
            this.uniforms,
            faceParams(built.recipe, built.layout, built.face)
        );
        this.uniforms.inkWidth.value = built.layout.ink;
        this.uniforms.shade.value = built.recipe.look.shade;
    }

    setExpression(expression: Partial<ToonExpression>) {
        applyExpression(this.uniforms, expression);
    }

    dispose() {
        this.root.removeFromParent();
        this.mesh.geometry.dispose();
        this.materials.fill.dispose();
        this.materials.ink.dispose();
        this.skeleton.dispose();
    }
}
