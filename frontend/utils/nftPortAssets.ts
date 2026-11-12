const API_PATH = "/api/assets/nftport";

export async function fetchOwnedNftPortAssets(owner: string) {
    return fetch(`${API_PATH}?type=byOwner&owner=${owner}`).then((res) =>
        res.json()
    );
}

export async function fetchCreatedNftPortAssets(creator: string) {
    return fetch(`${API_PATH}?type=byCreator&creator=${creator}`).then((res) =>
        res.json()
    );
}

export async function fetchNftPortAssetById(
    owner: string,
    address: string,
    tokenId: string
) {
    return fetch(
        `${API_PATH}?type=byId&owner=${owner}&address=${address}&tokenId=${tokenId}`
    ).then((res) => res.json());
}
