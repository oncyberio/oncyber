// Share the same imports between preloading and rendering so chunks are reused.
export const loadStudio = () => import("./index");
export const loadStudioScene = () =>
    import("@components/_3DExhibit-v2/displyUI/EditModeSceneV2");
export const loadStudioTools = () => import("./EditWorldMenu");
export const loadStudioMenu = () => import("./StudioMenu");

export function preloadStudio() {
    // Importing code does not mount the editor or start a scene session.
    return Promise.all([
        loadStudio(),
        loadStudioScene(),
        loadStudioTools(),
        loadStudioMenu(),
    ]);
}
