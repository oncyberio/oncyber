import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
} from "react";
import {
    CameraSample,
    createVideoEngine,
    NavigationMode,
    PathKind,
    Vec3,
    VideoEngine,
    VideoEngineArtwork,
    VideoEngineShot,
    VideoSetDefinition,
    ViewMode,
} from "../engine/createVideoEngine";

export interface VideoViewportHandle {
    capturePoster(): string | null;
    cameraSample(): CameraSample | null;
}

interface VideoViewportProps {
    set: VideoSetDefinition;
    shot: VideoEngineShot;
    artworks: VideoEngineArtwork[];
    mode: ViewMode;
    pathKind: PathKind;
    activePathPointIndex: number;
    normalizedTime: number;
    navigationMode: NavigationMode;
    onPathPointPreview?: (kind: PathKind, index: number, value: Vec3) => void;
    onPathPointCommit: (kind: PathKind, index: number, value: Vec3) => void;
    onPathPointSelect: (kind: PathKind, index: number) => void;
    onSelectArtwork: (id: string) => void;
}

export const VideoViewport = forwardRef<
    VideoViewportHandle,
    VideoViewportProps
>(function VideoViewport(
    {
        set,
        shot,
        artworks,
        mode,
        pathKind,
        activePathPointIndex,
        normalizedTime,
        navigationMode,
        onPathPointPreview,
        onPathPointCommit,
        onPathPointSelect,
        onSelectArtwork,
    },
    ref
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<VideoEngine>(null);
    const callbacksRef = useRef({
        onPathPointPreview,
        onPathPointCommit,
        onPathPointSelect,
        onSelectArtwork,
    });
    callbacksRef.current = {
        onPathPointPreview,
        onPathPointCommit,
        onPathPointSelect,
        onSelectArtwork,
    };

    useLayoutEffect(() => {
        if (!canvasRef.current) return;
        const engine = createVideoEngine(canvasRef.current, {
            onPathPointPreview: (...args) =>
                callbacksRef.current.onPathPointPreview?.(...args),
            onPathPointCommit: (...args) =>
                callbacksRef.current.onPathPointCommit(...args),
            onPathPointSelect: (...args) =>
                callbacksRef.current.onPathPointSelect(...args),
            onSelectArtwork: (...args) =>
                callbacksRef.current.onSelectArtwork(...args),
        });
        engineRef.current = engine;
        return () => {
            engine.dispose();
            engineRef.current = null;
        };
    }, []);

    useEffect(() => engineRef.current?.loadSet(set), [set]);
    useEffect(() => engineRef.current?.setShot(shot), [shot]);
    useEffect(() => engineRef.current?.setArtworks(artworks), [artworks]);
    useEffect(() => engineRef.current?.setMode(mode), [mode]);
    useEffect(
        () => engineRef.current?.setNavigationMode(navigationMode),
        [navigationMode]
    );
    useEffect(() => engineRef.current?.setPathKind(pathKind), [pathKind]);
    useEffect(
        () => engineRef.current?.setActivePathPoint(activePathPointIndex),
        [activePathPointIndex]
    );
    useEffect(() => engineRef.current?.seek(normalizedTime), [normalizedTime]);

    useImperativeHandle(
        ref,
        () => ({
            capturePoster: () => engineRef.current?.capturePoster() || null,
            cameraSample: () => engineRef.current?.cameraSample() || null,
        }),
        []
    );

    return (
        <canvas
            ref={canvasRef}
            data-video-viewport
            tabIndex={0}
            aria-label="3D video editor viewport"
        />
    );
});
