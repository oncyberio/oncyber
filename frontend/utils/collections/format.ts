export function formatCollection(collection) {
    const {
        editors,
        created_date,
        description,
        discord_url,
        external_url,
        name,
        slug,
        twitter_username,
        instagram_username,
        payout_address,
        payment_tokens,
        is_nsfw,
        primary_asset_contracts,
        ...rest
    } = collection;

    const images: any = {};

    if (rest["featured_image_url"])
        images.featured_image_url = rest["featured_image_url"];

    if (rest["large_image_url"])
        images.large_image_url = rest["large_image_url"];

    if (rest["image_url"]) images.image_url = rest["image_url"];

    if (rest["banner_image_url"])
        images.banner_image_url = rest["banner_image_url"].cloudinary;

    const socials: any = {};

    if (discord_url) socials.discord_url = discord_url;

    if (external_url) socials.external_url = external_url;

    if (twitter_username) socials.twitter_username = twitter_username;

    if (instagram_username) socials.instagram_username = instagram_username;

    return {
        editors,
        name,
        slug,
        description,
        payout_address,
        socials,
        images,
        created_date,
        original_name: name,
        tags: [name],
        is_nsfw,
        contract_address: primary_asset_contracts?.[0]?.address,
        payment_tokens: (payment_tokens || []).map((token) => {
            return {
                symbol: token.symbol,
                address: token.address,
                image_url: token.image_url,
                name: token.name,
            };
        }),
    };
}
