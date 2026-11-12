export function formatAsset(asset) {
    if (asset?.data?.id === "-84.39X19.13X-223.40X0.00X1.57X0.00") {
        const logoURL =
            "https://cyber.mypinata.cloud/ipfs/QmYJbW9qzpcxuMLFGuNxtobNARjGpYc4MfdZFpsjVM8KZs?filename=sothebys_logo_fb4s51.png";

        const wallet = "0x5826eacada6c726c8f46bfd2c1a2b16d1d363aff";

        const name = "Shoteby's";

        asset.data.collection = {};
        asset.data.contract = {};
        asset.data.addedBy = wallet;

        asset.data.name = name;
        asset.data.token_address = "";
        asset.data.token_id = "";
        asset.data.description = "";

        asset.data.owner.address = wallet;
        asset.data.owner.user.username = name;
        asset.data.owner.profile_img_url = logoURL;

        asset.data.creator.address = wallet;
        asset.data.creator.user.username = name;
        asset.data.creator.profile_img_url = logoURL;

        asset.data.image_original_url = logoURL;
        asset.data.image_preview_url = logoURL;
        asset.data.dcompressed_image_url = logoURL;
    }

    return asset;
}
