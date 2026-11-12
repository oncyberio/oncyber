/** @jest-environment jsdom */
import {
    createStencilPortal,
    stencilPortalCaptureScale,
    STENCIL_PORTAL_RADIUS,
} from "./webgpu/stencilPortal";

test("builds the aperture and energy fringe as node materials", () => {
    const portal = createStencilPortal();
    const names = portal.group.children.map((child) => child.name);
    expect(names).toEqual([
        "lobby-stencil-portal-aperture",
        "lobby-stencil-portal-fringe",
        "lobby-stencil-portal-sparks",
    ]);
    const aperture = portal.aperture as any;
    expect(aperture.material.isNodeMaterial).toBe(true);
    expect(aperture.material.opacityNode).toBeTruthy();
    // The plane covers the wavy boundary's full envelope.
    const size = aperture.geometry.parameters.width;
    expect(size).toBeGreaterThan(STENCIL_PORTAL_RADIUS * 2);
    expect(() =>
        portal.update({ time: 1, opening: 0.5, opacity: 1, heading: 0.3 })
    ).not.toThrow();
    expect(
        portal.group.getObjectByName("lobby-stencil-portal-floor-fold")
    ).toBeUndefined();
    expect((portal.group.children[2] as any).count).toBe(720);
    portal.setDestination();
    portal.dispose();
    expect(portal.group.parent).toBeNull();
});

test("the saved 360 widens with distance like native portals", () => {
    expect(stencilPortalCaptureScale(2)).toBe(1);
    expect(stencilPortalCaptureScale(6.5)).toBeCloseTo(3);
    expect(stencilPortalCaptureScale(20)).toBe(5);
});
