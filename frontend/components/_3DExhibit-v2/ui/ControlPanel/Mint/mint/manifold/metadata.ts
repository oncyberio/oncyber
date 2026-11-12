import moment from "moment";

/** Campaign details for a Manifold claim, shown when it is placed in a space. */
export async function fetchManifoldMetadata(campaignSlug: string) {
    const response = await fetch(
        `https://apps.api.manifoldxyz.dev/campaign/${campaignSlug}`
    );

    const data = await response.json();

    if (data.error) {
        return null;
    }

    let format = null;

    // How do we get the supply left
    if (data.requirements.arweaveURL) {
        try {
            const response = await fetch(data.requirements.arweaveURL);

            const metadata = await response.json();

            format = {
                mime_type:
                    metadata?.animation_details?.format === "GLB"
                        ? "model/gltf-binary"
                        : null,
                animation_url: metadata?.animation_url,
            };
        } catch (err) {
            console.log("err", err);
        }
    }

    return {
        description: data.description,
        image: data.image,
        name: data.name,
        fullName: data.name,
        token: "",
        priceWei: 0,
        price: 0,
        startDate: data?.startDate ? moment(data?.startDate) : null,
        endDate: data?.endDate ? moment(data?.endDate) : null,
        creator: {
            ...data.creator,
            image: data.image,
        },
        requirements: data.requirements,
        format,
        eligibleQuantity: 0,
        mintedQuantity: 0,
    };
}
