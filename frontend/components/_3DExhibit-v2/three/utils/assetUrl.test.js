import { isGlbUrl, isManagedModelUrl } from "./assetUrl";
const cid = "QmQ3Qpv3qPVT5dXPbNmDsF63AFtC1GvQKy6ggVwDTGeCKj";
test.each([
    "/room.GLB?v=2#test",
    "/room%2Eglb?signature=abc%2Fdef",
    `https://cyber.mypinata.cloud/ipfs/${cid}?filename=room%20low.glb&token=private`,
    "https://assets.test/model?filename=room.GLB",
])("recognizes model filenames without editing the request: %s", (url) => {
    expect(isGlbUrl(url)).toBe(true);
});
test.each([
    "/room.gltf?v=.glb",
    "/room.gltf?filename=room.glb",
    "/room.png?version=glb",
    "/broken%GG.glb",
    null,
    "",
])("does not infer a GLB from unrelated query data: %s", (url) => {
    expect(isGlbUrl(url)).toBe(false);
});
test("opaque managed model assets can use persistent caching", () => {
    expect(
        isManagedModelUrl(
            `https://cyber.mypinata.cloud/ipfs/${cid}?filename=kl7zpmetmhsyvob4tlmk`
        )
    ).toBe(true);
    expect(isManagedModelUrl(`https://cyber.mypinata.cloud/ipfs/${cid}`)).toBe(
        true
    );
});
test.each([
    `https://other.mypinata.cloud/ipfs/${cid}`,
    `https://cyber.mypinata.cloud.evil.test/ipfs/${cid}`,
    `https://private@cyber.mypinata.cloud/ipfs/${cid}`,
    `http://cyber.mypinata.cloud/ipfs/${cid}`,
    `https://cyber.mypinata.cloud:1234/ipfs/${cid}`,
    `https://cyber.mypinata.cloud/ipfs/${cid}/file.gltf`,
    "https://cyber.mypinata.cloud/ipfs/invalid",
    `https://cyber.mypinata.cloud/ipns/${cid}`,
    "https://cyber.mypinata.cloud/models/current.glb",
])(
    "does not broaden managed caching to unrelated model hosts/paths: %s",
    (url) => {
        expect(isManagedModelUrl(url)).toBe(false);
    }
);
