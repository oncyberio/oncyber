import { uploadTextureBatch } from "./uploadTextureBatch";

test("cheap uploads share frames, deduplicate textures and finish without an extra frame", async () => {
    const uploaded: number[] = [];
    const batches: number[] = [];
    await uploadTextureBatch(
        [1, 2, 2, 3, 4, 5, 6, 7, 8, 9],
        (value) => {
            uploaded.push(value);
        },
        async () => {
            batches.push(uploaded.length);
        },
        { now: () => 0 }
    );
    expect(uploaded).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(batches).toEqual([4, 8]);
});

test("expensive uploads yield before the batch limit", async () => {
    let clock = 0;
    const uploaded: number[] = [];
    const batches: number[] = [];
    await uploadTextureBatch(
        [1, 2, 3],
        (value) => {
            uploaded.push(value);
            clock += 5;
        },
        async () => {
            batches.push(uploaded.length);
        },
        { now: () => clock }
    );
    expect(batches).toEqual([1, 2]);
});

test("cancelling a scene while yielding stops subsequent GPU work", async () => {
    const controller = new AbortController();
    const upload = jest.fn();
    await expect(
        uploadTextureBatch(
            [1, 2, 3, 4, 5],
            upload,
            async () => {
                controller.abort();
            },
            { now: () => 0, signal: controller.signal }
        )
    ).rejects.toThrow();
    expect(upload).toHaveBeenCalledTimes(4);
});

test("already aborted sessions and failed uploads never queue another frame", async () => {
    const controller = new AbortController();
    controller.abort();
    const upload = jest.fn();
    const frame = jest.fn();
    await expect(
        uploadTextureBatch([1], upload, frame, { signal: controller.signal })
    ).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
    await expect(
        uploadTextureBatch(
            [1, 2],
            () => {
                throw new Error("GPU failed");
            },
            frame
        )
    ).rejects.toThrow("GPU failed");
    expect(frame).not.toHaveBeenCalled();
});

test("shared budget holds uploads and cancellation while queued prevents GPU work", async () => {
    const lifetime = new AbortController();
    let release: () => void;
    const beforeUpload = jest.fn(
        () =>
            new Promise<void>((resolve) => {
                release = resolve;
            })
    );
    const upload = jest.fn();
    const pending = uploadTextureBatch([1, 2], upload, jest.fn(), {
        signal: lifetime.signal,
        beforeUpload,
    });
    expect(beforeUpload).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
    lifetime.abort();
    release();
    await expect(pending).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
    expect(beforeUpload).toHaveBeenCalledTimes(1);
});

test("waiting for the shared scheduler does not consume the GPU upload budget", async () => {
    let clock = 0;
    const uploaded: number[] = [];
    const batches: number[] = [];
    await uploadTextureBatch(
        [1, 2, 3, 4, 5],
        (texture) => {
            uploaded.push(texture);
            clock += 0.2;
        },
        async () => {
            batches.push(uploaded.length);
        },
        {
            now: () => clock,
            beforeUpload: async () => {
                clock += 50;
            },
        }
    );
    expect(batches).toEqual([4]);
});
