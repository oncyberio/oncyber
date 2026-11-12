export type Destinations = {
    _id: string;
    status: string;
    slug: string;
    params: Record<string, any>;
    path?: string;
    author: {
        id: string;
        email?: string;
        userId: string;
        name: string;
        twitter?: string;
    };
    price?: number;
    quantity?: number;
    startTime?: number;
    endTime?: number;
    token_id?: string;
    name: string;
    thumbnail: string;
    description: string;
    shareCyber?: number;
    openSeaUrl?: string;
    preMinted?: boolean;
    animationHash?: string;
    animation_url?: string;
    numberOfEditions?: string;
    distributionType?: string;
    nonFungible?: boolean;
    contractName?: string;
    blockchain?: "ethereum" | "polygon";
    chain?: string;
    contract_address?: string;
    token_id?: number;
    tag: string[];
    project?: string;
    max_number_of_tokens?: number;
    paths: {
        low: string;
        mid: string;
        high: string;
    };
    spline?: string;
    whitelist_url?: string;
    openseaLink?: string;
    collection?: string;
    capacity: number;
    nbElements?: number;
    image?: string;
    editions?: number | "∞";
    nbElements?: number;
};

export type Destination = Destinations;

export type SceneData = {
    placeholderIds: Array<string | number>;
    portalIds: Array<string | number>;
    placeholdersSize: number;
    portalsSize: number;
};

export type UploaderSceneData = {
    placeholders: Array<{
        position: [number, number, number];
        rotation: [number, number, number, number];
    }>;
    portals: Array<string | number>;
};
