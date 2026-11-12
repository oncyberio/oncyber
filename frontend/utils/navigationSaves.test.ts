import {
    registerNavigationSave,
    prepareNavigation,
    trackNavigationSave,
    waitForNavigationSaves,
} from "./navigationSaves";
test("navigation waits for a pending draft write and unregisters on exit", async () => {
    let finish;
    const save = jest.fn(
        () =>
            new Promise<void>((r) => {
                finish = r;
            })
    );
    const unregister = registerNavigationSave(save);
    let navigated = false;
    const navigation = prepareNavigation().then(() => {
        navigated = true;
    });
    await Promise.resolve();
    expect(navigated).toBe(false);
    finish();
    await navigation;
    expect(navigated).toBe(true);
    unregister();
    await prepareNavigation();
    expect(save).toHaveBeenCalledTimes(1);
});
test("a failed save rejects navigation, and a retry can succeed", async () => {
    const save = jest
        .fn()
        .mockRejectedValueOnce(Error("offline"))
        .mockResolvedValueOnce(undefined);
    const unregister = registerNavigationSave(save);
    await expect(prepareNavigation()).rejects.toThrow("offline");
    await expect(prepareNavigation()).resolves.toBeUndefined();
    unregister();
});
test("anonymous hydration waits for saves triggered by browser Back", async () => {
    let finish;
    trackNavigationSave(
        new Promise<void>((r) => {
            finish = r;
        })
    );
    let hydrated = false;
    const hydration = waitForNavigationSaves().then(() => {
        hydrated = true;
    });
    await Promise.resolve();
    expect(hydrated).toBe(false);
    finish();
    await hydration;
    expect(hydrated).toBe(true);
});
