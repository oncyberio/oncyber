interface ICollection {
    id?: string;
    socials: {
        external_url: string;
        discord_url: string;
        instagram_username: string;
        twitter_username: string;
    };
    slug: string;
    name: string;
    images: {
        banner_image_url: string;
        image_url: string;
        featured_image_url: string;
        large_image_url: string;
    };
    description: string;
    payment_tokens: Array<{
        address: string;
        image_url: string;
        name: string;
        symbol: string;
    }>;
    payout_address: string;
    tags: string[];
    editors: string[];
    created_date: string;
    contract_address: string;
    is_nsfw: boolean;
}
