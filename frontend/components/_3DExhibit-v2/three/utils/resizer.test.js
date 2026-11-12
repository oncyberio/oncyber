const mockConstants = {
    DPI: 1,
    QUALITY: "high",
    QUALITIES: { HIGH: "high", MEDIUM: "medium", LOW: "low" },
};
jest.mock("@3constants", () => mockConstants, { virtual: true });

const {
    resizer,
    setResolutionScale,
    getResolutionScale,
} = require("./resizer");

// resizer rounds by a pixel either way; compare each axis' share.
const share = ({ width, height }) => [
    Math.round((width / 1000) * 100) / 100,
    Math.round((height / 500) * 100) / 100,
];

afterEach(() => {
    setResolutionScale(1);
    mockConstants.QUALITY = "high";
});

test("without the governor each quality keeps its size", () => {
    expect(resizer(1000, 500)).toEqual({ width: 1000, height: 500 });
    mockConstants.QUALITY = "medium";
    expect(share(resizer(1000, 500))).toEqual([0.8, 0.8]);
});

test("the governor's scale multiplies the quality's own size", () => {
    setResolutionScale(0.9);
    expect(getResolutionScale()).toBe(0.9);
    expect(share(resizer(1000, 500))).toEqual([0.9, 0.9]);
});

test("nothing goes below LOW's size", () => {
    setResolutionScale(0.5);
    expect(share(resizer(1000, 500))).toEqual([0.6, 0.6]);
    mockConstants.QUALITY = "medium";
    setResolutionScale(0.6);
    expect(share(resizer(1000, 500))).toEqual([0.6, 0.6]);
});

test("invalid scales reset to the quality's own size", () => {
    setResolutionScale(0);
    expect(getResolutionScale()).toBe(1);
    setResolutionScale(2);
    expect(getResolutionScale()).toBe(1);
});
