

export default {

    //* Regular worker bot
    "0x253ef258563e146f685e60219da56a6b75178e19": (item) => {
        if(item?.id?.tokenId === "0x05"){
            return {
                metadata: {
                    vrm_url:
                        "https://cyber.mypinata.cloud/ipfs/QmazYQfpJDoGZHgaM5ro1PXmc5G4S7Vf73QodwRdeyhjMA?filename=WorkerBot_v1_g7fuqc.glb",
                    name: "Workerbot",
                    image: "https://cyber.mypinata.cloud/ipfs/QmP99jimt7oSwb3KVAGuNhkeZfDUfRAM3gRfGzD21EcvAw?filename=1686752460-u1686752459.371.png",
                    description:
                        "The WorkerBots are the Wandersmith’s trusted assistants, carrying out all types of tasks for the Artisan.",
                },
            };
        }
        return null;
    },

    //* Worker bots with traits
    "0xe75836a73fc0bcb7e63f70c9173eb86b4bf0d282": (item) => {
        if (!item?.metadata?.attributes?.length) return null;
        if (!item?.metadata?.attributes.some((attr) => attr.trait_type == "ARTEFACT" && attr.value == "WorkerBot")) return null;
        const idTrait = item?.metadata?.attributes.find((attr) => attr.trait_type == "ID")?.value?.toUpperCase();
        if (!idTrait) return null;
        let metadata = {};
        switch (idTrait) {
            case "EXPLORATION":
                metadata = {
                    image: "https://cyber.mypinata.cloud/ipfs/QmQ5r4Fsiw9ikyYCg9bQuE8wAthMNs4pwuEP2arF9rzZ9o?filename=WorkerBot_v2_Confidence_Icon_1_piuozi.webp",
                    vrm_url:
                        "https://cyber.mypinata.cloud/ipfs/QmYZD7veYRsTKybx5iRyNqWi9RLLeKRntmXq51oHwXjaNS?filename=WorkerBot_v2_Exploration_mjeqxq.glb",
                    name: "Exploration",
                    description:
                        "Embrace the unknown, venture forth, and discover the incredible wonders that await.",
                };
                break;
            case "CONFIDENCE":
                metadata = {
                    image: "https://cyber.mypinata.cloud/ipfs/QmUPKNU53Q3jYkdDEdkdGbBL7RpXzoT5nca5YA8k9ofefL?filename=WorkerBot_v2_Confidence_Icon_w3hysf.webp",
                    vrm_url:
                        "https://cyber.mypinata.cloud/ipfs/Qmd69upwqB8b1Qf5cKaMHGvxm2RyFziWmA21h54rAiWGtL?filename=WorkerBot_v2_Confidence_uey5bk.glb",
                    name: "Confidence",
                    description:
                        "Believe in yourself and your abilities. Confidence is the key to unlocking your limitless potential.",
                };
                break;
            case "VISION":
                metadata = {
                    image: "https://cyber.mypinata.cloud/ipfs/QmWEuDB6B73k24a5XDtSFpurce8X7NZhWStyUApo6D3D9T?filename=WorkerBot_v2_Confidence_Icon_3_mx1vq2.webp",
                    vrm_url:
                        "https://cyber.mypinata.cloud/ipfs/QmNf3hzxLeKjpUgPLocJfbNpzuY9H5RM7PxUDKpTCZytPW?filename=WorkerBot_v2_Vision_m8mbhh.glb",
                    name: "Vision",
                    description:
                        "Sight beyond sight. See beyond the horizon, dream without limits, and shape a future of endless possibilities.",
                };
                break;
            case "MIMIC":
                metadata = {
                    image: "https://cyber.mypinata.cloud/ipfs/QmTFegQt8hNqmAaE1aWqrbW8UhYdwTp2oXDSTnKdHttj69?filename=WorkerBot_v2_Confidence_Icon_2_ky8uvo.webp",
                    vrm_url:
                        "https://cyber.mypinata.cloud/ipfs/QmRaTg9vjCSL4z4wBkoijHaejavch3TXJh8wEbwC5Gr6eo?filename=WorkerBot_v2_Mimic_ojlbyh.glb",
                    name: "Mimic",
                    description:
                        "Behind every disguise lies boundless intrigue and unexpected treasures.",
                };
                break;
            default:
                return null;
        }
        return {metadata};
    }
}