import { Box3, Matrix4, Quaternion, Vector3 } from "three";

const MINIMUM_DISTANCE = 4.6;
const CLEARANCE = 1.5;
const VIEWPORT_FRACTION = 0.5;

/**
 * Move a newly created artwork far enough from the camera to see its size.
 * Measure only its content/raycast mesh so editor handles cannot affect fitting.
 * @param {import("three").Object3D & { raycastMesh?: import("three").Object3D, renderMesh?: import("three").Object3D }} artwork
 * @param {import("three").PerspectiveCamera} camera
 * @returns {number} Distance from the camera to the visual center, in world units.
 */
export function placeArtworkInFrontOfCamera(artwork, camera) {
    artwork.updateWorldMatrix(true, true);
    camera.updateWorldMatrix(true, false);

    const cameraPosition = camera.getWorldPosition(new Vector3());
    const cameraRotation = camera.getWorldQuaternion(new Quaternion());
    // Ignore any camera-parent scale: distances and geometry remain world units.
    const cameraFrame = new Matrix4().compose(
        cameraPosition,
        cameraRotation,
        new Vector3(1, 1, 1)
    );
    const worldToView = cameraFrame.clone().invert();
    const bounds = new Box3();
    const corner = new Vector3();
    const meshToView = new Matrix4();
    const content = artwork.raycastMesh || artwork.renderMesh || artwork;
    content.updateWorldMatrix(true, true);

    const includeGeometry = (mesh) => {
        const geometry = mesh.geometry;
        if (!geometry) return;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        if (!box || box.isEmpty()) return;
        meshToView.multiplyMatrices(worldToView, mesh.matrixWorld);
        for (const x of [box.min.x, box.max.x]) {
            for (const y of [box.min.y, box.max.y]) {
                for (const z of [box.min.z, box.max.z]) {
                    corner.set(x, y, z).applyMatrix4(meshToView);
                    if (corner.toArray().every(Number.isFinite)) {
                        bounds.expandByPoint(corner);
                    }
                }
            }
        }
    };
    // A dedicated mesh's children may contain editor decorations.
    if (content.geometry) includeGeometry(content);
    else content.traverse(includeGeometry);

    const artworkPosition = artwork.getWorldPosition(new Vector3());
    const center = bounds.isEmpty()
        ? artworkPosition.clone().applyMatrix4(worldToView)
        : bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const verticalFov = camera.getEffectiveFOV() * (Math.PI / 180);
    const tanVertical = Math.tan(verticalFov / 2);
    const tanHorizontal = tanVertical * camera.aspect;
    const fitDistance = Math.max(
        size.x / (2 * tanHorizontal * VIEWPORT_FRACTION),
        size.y / (2 * tanVertical * VIEWPORT_FRACTION)
    );
    const distance =
        Math.max(MINIMUM_DISTANCE, fitDistance) + CLEARANCE + size.z / 2;
    const targetCenter = new Vector3(0, 0, -distance).applyMatrix4(cameraFrame);
    const currentCenter = center.applyMatrix4(cameraFrame);
    artworkPosition.add(targetCenter).sub(currentCenter);
    if (artwork.parent) artwork.parent.worldToLocal(artworkPosition);
    artwork.position.copy(artworkPosition);
    artwork.updateWorldMatrix(true, true);
    return distance;
}
