import { Box3, Matrix3, Vector3 } from "three";

// Parents first, then the subtree through updateMatrixWorld: r180 SkinnedMesh
// only refreshes its attached-mode bindMatrixInverse there, not in updateWorldMatrix.
function updateWorld(object) {
    object.updateWorldMatrix(true, false);
    object.updateMatrixWorld(true);
}

// Older Three builds don't include the current skin pose in Box3.setFromObject.
// Measure the visible model, excluding its unposed selection/raycast box.
export function getAvatarBounds(object, box = new Box3()) {
    box.makeEmpty();
    updateWorld(object);
    const point = new Vector3();
    object.traverse((mesh) => {
        if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
        const positions = mesh.geometry.attributes.position;
        if (mesh.isSkinnedMesh) mesh.skeleton.update();
        for (let index = 0; index < positions.count; index++) {
            point.fromBufferAttribute(positions, index);
            if (mesh.isSkinnedMesh) mesh.applyBoneTransform(index, point);
            point.applyMatrix4(mesh.matrixWorld);
            box.expandByPoint(point);
        }
    });
    return box;
}

export function placeFeetOnGround(object, groundPoint, cachedOffset = null) {
    object.position.copy(groundPoint);
    updateWorld(object);
    const visibleModel =
        object.renderMesh ||
        object.preview?.renderMesh ||
        object.preview ||
        object;
    let offset = cachedOffset;
    if (offset == null) {
        const bounds = getAvatarBounds(visibleModel);
        offset = bounds.isEmpty() ? 0 : groundPoint.y - bounds.min.y;
    }
    object.position.y += offset;
    updateWorld(object);
    return offset;
}

export function findGroundHit(intersections) {
    const matrix = new Matrix3();
    const normal = new Vector3();
    return (
        intersections.find((hit) => {
            if (!hit.face) return false;
            matrix.getNormalMatrix(hit.object.matrixWorld);
            // Imported double-sided floors can have downward-facing normals.
            return (
                Math.abs(
                    normal.copy(hit.face.normal).applyNormalMatrix(matrix).y
                ) > 0.5
            );
        }) || null
    );
}
