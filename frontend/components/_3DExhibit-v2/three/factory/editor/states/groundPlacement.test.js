import {
    Bone,
    BoxGeometry,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshBasicMaterial,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute,
    Vector3,
} from "three";
import {
    findGroundHit,
    getAvatarBounds,
    placeFeetOnGround,
} from "./groundPlacement";

test("a late model replaces the portrait without inheriting its height offset", () => {
    const dropPoint = new Vector3(3, 0.4, -6);
    const drag = new Group();
    const portrait = new Mesh(new BoxGeometry(1, 2, 0.01));
    drag.preview = portrait;
    drag.add(portrait);
    placeFeetOnGround(drag, dropPoint);
    expect(drag.position.y).toBeCloseTo(1.4);
    const avatar = new Group();
    avatar.renderMesh = new Mesh(new BoxGeometry(1, 3, 1));
    avatar.renderMesh.position.y = -0.3;
    avatar.add(avatar.renderMesh);
    // The selection box must not influence the character's foot position.
    avatar.add(new Mesh(new BoxGeometry(5, 10, 5)));
    avatar.scale.setScalar(2);
    drag.remove(portrait);
    drag.preview = avatar;
    drag.add(avatar);
    placeFeetOnGround(drag, dropPoint);
    expect(getAvatarBounds(avatar.renderMesh).min.y).toBeCloseTo(0.4);
    drag.remove(avatar);
    placeFeetOnGround(avatar, dropPoint);
    expect(getAvatarBounds(avatar.renderMesh).min.y).toBeCloseTo(0.4);
    expect(avatar.position.x).toBe(3);
    expect(avatar.position.z).toBe(-6);
});

test("foot measurements include the current skeletal pose", () => {
    const geometry = new BoxGeometry(1, 2, 1);
    const count = geometry.attributes.position.count;
    geometry.setAttribute(
        "skinIndex",
        new Uint16BufferAttribute(new Uint16Array(count * 4), 4)
    );
    const weights = new Float32Array(count * 4);
    for (let index = 0; index < count; index++) weights[index * 4] = 1;
    geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
    const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
    const bone = new Bone();
    mesh.add(bone);
    mesh.bind(new Skeleton([bone]));
    bone.position.y = -2;
    expect(getAvatarBounds(mesh).min.y).toBeCloseTo(-3);
    placeFeetOnGround(mesh, new Vector3());
    expect(getAvatarBounds(mesh).min.y).toBeCloseTo(0);
});

test("ground detection skips walls and accepts reversed floor normals", () => {
    const object = new Group();
    const wall = { object, face: { normal: new Vector3(1, 0, 0) } };
    const floor = { object, face: { normal: new Vector3(0, -1, 0) } };
    expect(findGroundHit([wall, floor])).toBe(floor);
    expect(findGroundHit([wall])).toBeNull();
});
