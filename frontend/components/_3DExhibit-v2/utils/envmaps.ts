export const ENVMAPS: Record<
    string,
    {
        id: string;
        path?: string;
        name?: string;
        image?: string;
        format?: string;
    }
> = {
    studio: {
        id: "studio",
        name: "Studio",
        image: "https://cyber.mypinata.cloud/ipfs/QmdsiCH8sZqaMhqVCwPWNGn22adEwKMVXGFxFo4panQQoa?filename=studio_nrfv4q.png",
        path: "https://cyber.mypinata.cloud/ipfs/Qmf36ZrHWzbgjvBM1MpvueR6sLaJb1zDTy7tHCjQD1RfKS?filename=studio_lvbl2a.hdr",
        format: ".hdr",
    },
    vig: {
        id: "vig",
        name: "Village",
        format: "hdr",
        image: "https://cyber.mypinata.cloud/ipfs/QmNjkuw4dveRC79BxqtQvwx2dCjqEvraK64T4u6dq4J9wU?filename=vig_xpruc1.png",
        path: "https://cyber.mypinata.cloud/ipfs/QmWAXFsbv6DoyU2U5vTYffHvm8dy9fUxJWtLYMRRSMDj4t?filename=vig2_iezgt4.hdr",
    },
    fields: {
        id: "fields",
        name: "Fields",
        image: "https://cyber.mypinata.cloud/ipfs/QmTw5BDU2RdMBVXGXDkiGkSrkXwwNrQPYdvzbPs2tcyhR9?filename=klop_g5aedd.png",
        path: "https://cyber.mypinata.cloud/ipfs/QmR64qF4jNSEszDg7iMXVUfhgvksfwrzxW9S93yJFu97N4?filename=klop1_bevmhh.hdr",
        format: ".hdr",
    },
    custom: {
        id: "custom",
        name: "Custom",
    },
};

export function getDefaultEnvMapIntensity(item) {
    // model defined envmap
    if (item.envmap == "custom") return 0;

    // we default to studio when there is no envmap
    // So we need to set the intensity to 1
    return 1;
}
