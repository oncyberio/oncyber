const computeFullscreenSize = (camPosition = 10, z = 0, width = 1, height = 1) => {
    const cameraZ = Globals.get('camera').position.z;
    const distance = Math.abs(z - cameraZ);
    const aspect = window.innerWidth / window.innerHeight;
    const vFov = Globals.get('camera').fov * Math.PI / 180;
    const planeHeightAtDistance = 2 * Math.tan(vFov / 2) * distance;
    const planeWidthAtDistance = planeHeightAtDistance * aspect;

    return [planeWidthAtDistance, planeHeightAtDistance];
};

export default computeFullscreenSize;
