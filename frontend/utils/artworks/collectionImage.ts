/** Saved Tezos collection logos can still point at the rate-limited IPFS gateway. */
export function collectionImageSources(image?: string, blockchain?: string) {
    if (!image) return [];
    if (blockchain !== "tezos") return [image];

    const cid = image.match(
        /^(?:ipfs:\/\/(?:ipfs\/)?|https:\/\/ipfs\.io\/ipfs\/)([a-zA-Z0-9]+)\/?(?:[?#].*)?$/
    )?.[1];
    if (!cid) return [image];

    return [
        `https://assets.objkt.media/file/assets-003/${cid}/thumb288`,
        image.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${cid}` : image,
    ];
}
