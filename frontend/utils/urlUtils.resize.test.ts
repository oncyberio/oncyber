import { isUrlResizable, resize } from "./urlUtils";

jest.mock("@env", () => ({ nodeEnv: {} }));

const cloud = "https://res.cloudinary.com/demo/image/upload/v1/art.jpg";
const pinata = "https://cyber.mypinata.cloud/ipfs/QmArt?filename=art.png";
const seadn = "https://i2c.seadn.io/s/raw/files/abc.png";

test("Cloudinary resizes also convert to WebP when asked", () => {
    expect(resize(cloud, 512, undefined, "webp")).toBe(
        "https://res.cloudinary.com/demo/image/upload/c_limit,fl_keep_dar,h_512,w_512,f_webp/v1/art.jpg"
    );
    // Without a format the URL is what it always was.
    expect(resize(cloud, 512)).toBe(
        "https://res.cloudinary.com/demo/image/upload/c_limit,fl_keep_dar,h_512,w_512/v1/art.jpg"
    );
});

test.each([
    ["an animated GIF", cloud.replace(".jpg", ".gif")],
    ["an SVG", cloud.replace(".jpg", ".svg")],
    ["a movie", cloud.replace(".jpg", ".mp4")],
    [
        "a URL that names its format",
        cloud.replace("/upload/", "/upload/f_png/"),
    ],
])("%s keeps its format", (_name, url) => {
    expect(resize(url, 256, undefined, "webp")).not.toContain("f_webp");
});

test("an already sized Cloudinary URL keeps its transform", () => {
    const sized = cloud.replace("/upload/", "/upload/w_2048,h_2048/");
    expect(resize(sized, 512, undefined, "webp")).toBe(
        cloud.replace("/upload/", "/upload/w_512,h_512/")
    );
});

test("Pinata and seadn are asked for size only", () => {
    const p = new URL(resize(pinata, 512, undefined, "webp"));
    expect(p.searchParams.get("img-width")).toBe("512");
    expect([...p.searchParams.keys()].sort()).toEqual([
        "filename",
        "img-fit",
        "img-height",
        "img-width",
    ]);
    const s = new URL(resize(seadn, 512, undefined, "webp"));
    expect([...s.searchParams.keys()]).toEqual(["w"]);
});

test("other hosts are not resizable and come back unchanged", () => {
    const other = "https://arweave.net/abc";
    expect(isUrlResizable(other)).toBe(false);
    expect(resize(other, 512, undefined, "webp")).toBe(other);
});
