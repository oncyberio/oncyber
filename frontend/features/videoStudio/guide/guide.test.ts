import { applyOperation, createDemoProject, createDemoShot } from "../model";
import {
    SEEDANCE_2_5_MODEL_ID,
    MockVideoProvider,
    createCameraManifest,
    sampleChordalSpline,
    serializeCameraManifest,
    type VideoGenerationRequest,
} from "./index";

describe("deterministic camera guide", () => {
    test("samples chordal splines at their exact endpoints", () => {
        const spline = {
            interpolation: "catmull-rom-chordal" as const,
            points: [
                [0, 0, 0],
                [1, 2, 0],
                [4, 2, -1],
            ] as const,
        };
        expect(sampleChordalSpline(spline, 0)).toEqual([0, 0, 0]);
        expect(sampleChordalSpline(spline, 1)).toEqual([4, 2, -1]);
        expect(sampleChordalSpline(spline, -2)).toEqual([0, 0, 0]);
    });

    test("produces the same complete 30 fps manifest every time", () => {
        const project = createDemoProject();
        const first = createCameraManifest(project);
        const second = createCameraManifest(project);
        expect(first.frameCount).toBe(150);
        expect(first.ticksPerFrame).toBe(1000);
        expect(first.frames[0].timestampUs).toBe(0);
        expect(first.frames[1].timestampUs).toBe(33_333);
        expect(first.frames[149].position).toEqual([-2.4, 1.8, -2.4]);
        expect(first.frames[149].target).toEqual([-1.8, 1.4, -2]);
        expect(serializeCameraManifest(first)).toBe(
            serializeCameraManifest(second)
        );
        expect(Object.isFrozen(first.frames)).toBe(true);
    });

    test("binds the manifest to the exact project revision", () => {
        const initial = createDemoProject();
        const changed = applyOperation(initial, {
            id: "camera-edit",
            source: "user",
            type: "camera.point.move",
            shotId: "shot-1",
            spline: "position",
            index: 0,
            point: [8, 3, 8],
        });
        expect(createCameraManifest(changed).projectRevision).toBe(1);
        expect(createCameraManifest(changed).frames[0].position).toEqual([
            8, 3, 8,
        ]);
    });

    test("uses the requested shot set instead of the project default", () => {
        const project = applyOperation(createDemoProject(), {
            id: "add-cobalt-shot",
            source: "user",
            type: "shot.add",
            shot: createDemoShot("shot-2", "cobalt-pavilion"),
            afterShotId: "shot-1",
        });

        expect(project.setId).toBe("white-cube");
        expect(createCameraManifest(project, "shot-1").setId).toBe(
            "white-cube"
        );
        expect(createCameraManifest(project, "shot-2").setId).toBe(
            "cobalt-pavilion"
        );
    });
});

describe("mock video provider", () => {
    let now: number;
    let provider: MockVideoProvider;
    let request: VideoGenerationRequest;

    beforeEach(() => {
        now = 1_000_000;
        provider = new MockVideoProvider(() => now);
        const project = createDemoProject();
        request = {
            projectId: project.id,
            projectRevision: project.revision,
            shotId: project.activeShotId,
            modelId: "mock-reference-v1",
            resolution: "1920x1080",
            prompt: "Turn the guide into a realistic architectural film.",
            guideUri: "blob:guide-video",
            cameraManifest: createCameraManifest(project),
        };
    });

    test("reports capabilities, quotes credits, and runs an idempotent job", async () => {
        const capabilities = await provider.capabilities();
        expect(capabilities[0].modelId).toBe(SEEDANCE_2_5_MODEL_ID);
        expect(capabilities[0].modes).toEqual([
            "t2v",
            "omni_reference",
            "video_edit",
            "video_extension",
        ]);
        expect(capabilities[0].inputs).toContain("guide-video");
        const quote = await provider.quote(request);
        expect(quote.credits).toBe(10);
        expect(quote.mode).toBe("omni_reference");
        expect(quote.durationSeconds).toBe(5);
        expect(quote.modelId).toBe(SEEDANCE_2_5_MODEL_ID);
        const job = await provider.submit(request, quote, "render-1");
        const duplicate = await provider.submit(request, quote, "render-1");
        expect(duplicate.id).toBe(job.id);
        expect(job.status).toBe("queued");
        expect(job.resolution).toBe("1920x1080");
        expect(job.generateAudio).toBe(true);

        now += 1_000;
        expect((await provider.advanceJob(job.id, 0.5)).status).toBe("running");
        const complete = await provider.advanceJob(job.id, 1);
        expect(complete.status).toBe("succeeded");
        expect(complete.output?.uri).toBe(`mock://video/${job.id}.mp4`);
    });

    test("quotes and submits a direct Seedance request without a camera manifest", async () => {
        const directRequest: VideoGenerationRequest = {
            projectId: "project-direct",
            projectRevision: 0,
            shotId: "concept-1",
            modelId: SEEDANCE_2_5_MODEL_ID,
            mode: "t2v",
            durationSeconds: 8,
            aspectRatio: "9:16",
            resolution: "1080p",
            generateAudio: true,
            bitrateMode: "high",
            prompt: "A cobalt sculpture rises through a sunlit impossible room.",
        };

        const quote = await provider.quote(directRequest);
        expect(quote).toMatchObject({
            modelId: SEEDANCE_2_5_MODEL_ID,
            mode: "t2v",
            durationSeconds: 8,
            aspectRatio: "9:16",
            resolution: "1080p",
            generateAudio: true,
            credits: 72,
        });

        const job = await provider.submit(
            directRequest,
            quote,
            "direct-render-1"
        );
        expect(job).toMatchObject({
            modelId: SEEDANCE_2_5_MODEL_ID,
            mode: "t2v",
            durationSeconds: 8,
            aspectRatio: "9:16",
            resolution: "1080p",
            generateAudio: true,
            bitrateMode: "high",
            status: "queued",
        });
    });

    test("keeps Three.js guidance optional but validates conditional modes", async () => {
        const guidedRequest: VideoGenerationRequest = {
            ...request,
            modelId: SEEDANCE_2_5_MODEL_ID,
            mode: "omni_reference",
            durationSeconds: 5,
            aspectRatio: "16:9",
            resolution: "720p",
            generateAudio: false,
        };
        const guidedQuote = await provider.quote(guidedRequest);
        expect(guidedQuote.credits).toBe(33);
        expect(guidedQuote.generateAudio).toBe(false);

        await expect(
            provider.quote({
                ...guidedRequest,
                mode: "t2v",
            })
        ).rejects.toThrow(/cannot include media guidance/i);

        await expect(
            provider.quote({
                projectId: "project-direct",
                projectRevision: 0,
                shotId: "concept-2",
                modelId: SEEDANCE_2_5_MODEL_ID,
                mode: "video_edit",
                durationSeconds: 8,
                aspectRatio: "16:9",
                resolution: "720p",
                prompt: "Replace the room while preserving the subject.",
            })
        ).rejects.toThrow(/source video reference/i);

        const editQuote = await provider.quote({
            projectId: "project-direct",
            projectRevision: 0,
            shotId: "concept-2",
            modelId: SEEDANCE_2_5_MODEL_ID,
            mode: "video_edit",
            durationSeconds: 8,
            aspectRatio: "16:9",
            resolution: "720p",
            prompt: "Replace the room while preserving @source-clip.",
            mediaReferences: [
                {
                    id: "source-clip",
                    uri: "blob:source-video",
                    kind: "video",
                    role: "source",
                    label: "Original edit",
                    metadata: {
                        mimeType: "video/mp4",
                        width: 1920,
                        height: 1080,
                        durationSeconds: 8,
                    },
                },
            ],
        });
        expect(editQuote.mode).toBe("video_edit");
    });

    test("rejects quote reuse for another request and supports cancellation", async () => {
        const quote = await provider.quote(request);
        await expect(
            provider.submit(
                { ...request, prompt: "A different request" },
                quote,
                "wrong-render"
            )
        ).rejects.toThrow(/quote does not match/i);
        const job = await provider.submit(request, quote, "render-2");
        expect((await provider.cancel(job.id)).status).toBe("cancelled");
    });

    test("refuses an expired quote", async () => {
        const quote = await provider.quote(request);
        now = quote.expiresAt;
        await expect(
            provider.submit(request, quote, "render-expired")
        ).rejects.toThrow(/expired/i);
    });
});
