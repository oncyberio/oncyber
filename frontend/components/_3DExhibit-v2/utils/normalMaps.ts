export const NORMALMAPS: Record<
    string,
    {
        id: string;
        path?: string;
        name?: string;
        image?: string;
        format?: string;
    }
> = {
    bump: {
        id: "bump",
        name: "Bump",
        image: "https://cyber.mypinata.cloud/ipfs/QmNxCXG9yrCoyQG8HdgC86wwakxYkGq3eNGS87GZAKQy1v?filename=bump-floor_fxrdig.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmNxCXG9yrCoyQG8HdgC86wwakxYkGq3eNGS87GZAKQy1v?filename=bump-floor_fxrdig.jpg",
        format: ".jpg",
    },
    ice: {
        id: "ice",
        name: "Ice",
        format: ".jpg",
        image: "https://cyber.mypinata.cloud/ipfs/QmSvG7p86tDnFcXrTHLTGkzPST8BWHaUbhYz41VMiUj4nv?filename=waternormals_ij5wyx.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmSvG7p86tDnFcXrTHLTGkzPST8BWHaUbhYz41VMiUj4nv?filename=waternormals_ij5wyx.jpg",
    },
    custom: {
        id: "custom",
        name: "Custom",
    }
};
