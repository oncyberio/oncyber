import { collectionImageSources } from "./collectionImage";

const cid = "QmZYtQ5sWiNy3AftDBtW29BW4MYhKgSCWBHtJxzzQMnf7u";
const gateway = `https://ipfs.io/ipfs/${cid}`;
const thumbnail = `https://assets.objkt.media/file/assets-003/${cid}/thumb288`;

test.each([gateway, `ipfs://${cid}`, `ipfs://ipfs/${cid}`])(
    "recovers a saved Tezos collection icon through Objkt: %s",
    (image) => {
        expect(collectionImageSources(image, "tezos")).toEqual([
            thumbnail,
            gateway,
        ]);
    }
);
test("does not rewrite unrelated chains, CDN images or directory paths", () => {
    expect(collectionImageSources(gateway, "ethereum")).toEqual([gateway]);
    expect(collectionImageSources(thumbnail, "tezos")).toEqual([thumbnail]);
    const nested = `${gateway}/logo.png`;
    expect(collectionImageSources(nested, "tezos")).toEqual([nested]);
    expect(collectionImageSources(undefined, "tezos")).toEqual([]);
});
