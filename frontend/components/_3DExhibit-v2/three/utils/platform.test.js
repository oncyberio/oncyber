/** @jest-environment jsdom */
import fs from "fs";
import path from "path";

jest.mock("@3constants", () => ({}), { virtual: true });
const getGPUTier = jest.fn();
jest.mock("detect-gpu", () => ({
    getGPUTier: (...args) => mockGetGPUTier(...args),
}));
const mockGetGPUTier = (...args) => getGPUTier(...args);

const memoryStorage = () => {
    const values = new Map();
    return {
        getItem: (key) => (values.has(key) ? values.get(key) : null),
        setItem: (key, value) => values.set(key, String(value)),
    };
};

beforeEach(() => {
    jest.resetModules();
    getGPUTier.mockReset();
    window.localStorage.clear();
});

test("the self-hosted benchmarks match the installed detect-gpu", () => {
    const { DETECT_GPU_VERSION } = require("./platform");
    const installed = path.dirname(require.resolve("detect-gpu"));
    const pkg = JSON.parse(
        fs.readFileSync(path.join(installed, "..", "package.json"), "utf8")
    );
    expect(pkg.version).toBe(DETECT_GPU_VERSION);
    const copied = path.join(
        __dirname,
        "../../../../public/detect-gpu",
        DETECT_GPU_VERSION
    );
    const shipped = fs.readdirSync(path.join(installed, "benchmarks")).sort();
    expect(fs.readdirSync(copied).sort()).toEqual(shipped);
});

test("detect-gpu reads the benchmarks from this site, once per page", async () => {
    getGPUTier.mockResolvedValue({ tier: 3, type: "BENCHMARK" });
    const { getGPU } = require("./platform");
    await expect(getGPU()).resolves.toMatchObject({ path: "high" });
    await expect(getGPU()).resolves.toMatchObject({ path: "high" });
    expect(getGPUTier).toHaveBeenCalledTimes(1);
    expect(getGPUTier).toHaveBeenCalledWith({
        benchmarksURL: "/detect-gpu/3.1.30",
    });
});

test("a remembered tier skips the lookup on the next visit", async () => {
    getGPUTier.mockResolvedValue({ tier: 1, type: "BENCHMARK" });
    await require("./platform").getGPU();
    jest.resetModules();
    const { getGPU } = require("./platform");
    await expect(getGPU()).resolves.toMatchObject({ path: "low" });
    expect(getGPUTier).toHaveBeenCalledTimes(1);
});

test("a fallback answer (benchmarks unreachable) is not remembered", async () => {
    getGPUTier.mockResolvedValue({ tier: 1, type: "FALLBACK" });
    await expect(require("./platform").getGPU()).resolves.toMatchObject({
        path: "mid",
    });
    expect(require("./platform").readRememberedGpuTier()).toBeNull();
});

test("a remembered tier expires, and belongs to one browser", () => {
    const { readRememberedGpuTier, rememberGpuTier } = require("./platform");
    const storage = memoryStorage();
    const result = { tier: 2, type: "BENCHMARK" };
    rememberGpuTier(result, storage, 1000, "browser A");
    expect(readRememberedGpuTier(storage, 2000, "browser A")).toEqual(result);
    expect(readRememberedGpuTier(storage, 2000, "browser B")).toBeNull();
    const week = 7 * 24 * 60 * 60 * 1000;
    expect(readRememberedGpuTier(storage, 1000 + week, "browser A")).toBeNull();
});

test("storage that throws only loses the shortcut", () => {
    const { readRememberedGpuTier, rememberGpuTier } = require("./platform");
    const broken = {
        getItem() {
            throw new Error("denied");
        },
        setItem() {
            throw new Error("denied");
        },
    };
    expect(() =>
        rememberGpuTier({ tier: 2, type: "BENCHMARK" }, broken)
    ).not.toThrow();
    expect(readRememberedGpuTier(broken)).toBeNull();
});
