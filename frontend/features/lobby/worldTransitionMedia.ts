import {
    buildWorldCubeReveal,
    type createWorldCubeReveal,
    type WorldCubeRevealOptions,
} from "./worldCubeReveal";
import { finishNow } from "./slicedWork";

/** Media can replace geometry as videos decode or models arrive. Rebuild only
 * this bounded layer; the much more expensive room tiles remain reusable. */
export function createWorldTransitionMedia(
    THREE: any,
    roots: any[],
    options: WorldCubeRevealOptions
) {
    return finishNow(buildWorldTransitionMedia(THREE, roots, options));
}

/** Yields wherever the tile build does; see slicedWork. */
export function* buildWorldTransitionMedia(
    THREE: any,
    roots: any[],
    options: WorldCubeRevealOptions
) {
    const skipped: Array<{ source: string; reason: string }> = [];
    const populated = roots.some((root) => {
        let found = false;
        root.traverse?.((object: any) => {
            found ||= object.isMesh === true;
        });
        return found;
    });
    if (populated) {
        // The architecture effect owns the scene sky/fog. A separately built
        // media layer must not capture and later restore its temporary black sky.
        const preserveSceneState = <T>(run: () => T): T => {
            const background = options.scene.background;
            const fog = options.scene.fog;
            try {
                return run();
            } finally {
                options.scene.background = background;
                options.scene.fog = fog;
            }
        };
        // The build only touches the sky after its last pause.
        const background = options.scene.background;
        const fog = options.scene.fog;
        let effect: ReturnType<typeof createWorldCubeReveal>;
        try {
            effect = yield* buildWorldCubeReveal(THREE, roots, {
                ...options,
                hideRoots: roots,
                onSkip: (object, reason) => {
                    options.onSkip?.(object, reason);
                    if (
                        process.env.NODE_ENV === "development" &&
                        skipped.length < 50
                    )
                        skipped.push({
                            source: object.name || object.uuid,
                            reason,
                        });
                },
                maxTriangles: 30000,
                maxCells: 2500,
                maxFragments: 6000,
                maxClipTests: 250000,
                rigidProps: {
                    minTriangles: 5000,
                    maxExtent: 5,
                    maxSources: 24,
                    maxTriangles: 150000,
                },
            });
        } finally {
            options.scene.background = background;
            options.scene.fog = fog;
        }
        return {
            stats: effect.stats,
            skipped,
            setProgress: (progress: number) =>
                preserveSceneState(() => effect.setProgress(progress)),
            setRevealAnchor: (
                anchor: WorldCubeRevealOptions["anchor"],
                extent?: number
            ) =>
                preserveSceneState(() =>
                    effect.setRevealAnchor(anchor, extent)
                ),
            dispose: () => preserveSceneState(() => effect.dispose()),
        };
    }
    // Empty roots may receive children during the transition. Keep them covered
    // without allocating a second geometry effect or touching the scene sky.
    const visibility = new Map(roots.map((root) => [root, root.visible]));
    let disposed = false;
    const setProgress = (progress: number) => {
        if (disposed) return;
        const intact =
            options.mode === "dissolve" ? progress <= 0 : progress >= 1;
        for (const [root, visible] of visibility)
            root.visible = intact ? visible : false;
    };
    setProgress(0);
    return {
        stats: { cells: 0, triangles: 0, skipped: 0, maxDistance: 0 },
        skipped,
        setProgress,
        setRevealAnchor: (
            _anchor: WorldCubeRevealOptions["anchor"],
            _extent?: number
        ) => {},
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const [root, visible] of visibility) root.visible = visible;
            visibility.clear();
        },
    };
}
