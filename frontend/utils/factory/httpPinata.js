import { nodeEnv } from "@env";

export async function uploadFile(file) {
    const body = new FormData();
    body.append("file", file);

    return fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        body,
        headers: {
            Authorization: `Bearer ${nodeEnv.PINATA_JWT_KEY}`,
        },
    })
        .then((res) => res.json())
        .catch(console.error);
}
