const SOUNDXYZ_API_KEY = process.env.NEXT_PUBLIC_SOUNDXYZ_API_KEY;

/** Release details for a sound.xyz edition, shown when it is placed in a space. */
export async function fetchSoundMetadata(contractAddress: string) {
    try {
        const query = `query ReleaseInfo($contractAddress:Address!$editionId:String){release:releaseContract(contractAddress:$contractAddress editionId:$editionId){id contractAddress editionId type externalUrl openseaUrl layloUrl title behindTheMusic season totalRaised totalRaisedPrimaryUsd totalRaisedSecondaryUsd genre{id name}track{id duration normalizedPeaks}artist{id gemCollectionUrl season soundHandle spotifyUrl bannerImage{id url}user{id publicAddress description displayName email twitterHandle avatar{id url}bannerImage{id url}}}rewards{id description numOfBackers price title}coverImage{id url}goldenEggImage{id url}}}`;

        const CLIENT_KEY_HEADER = "x-sound-client-key";

        const request = await fetch("https://api.sound.xyz/graphql", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                [CLIENT_KEY_HEADER]: SOUNDXYZ_API_KEY,
            },
            body: JSON.stringify({
                query,
                variables: {
                    contractAddress,
                },
            }),
            mode: "cors",
        });

        const data = await request.json();

        if (data.data.release) {
            return {
                name: data.data.release.title,
                fullName: data.data.release.title,
                description: data.data.release.title,
                image: data.data.release.coverImage.url,
                token: data.data.release.contractAddress,
                priceWei: 0,
                price: 0,
                startDate: null,
                endDate: null,
                mintType: "",
                creator: {
                    id: data.data.release.artist.id,
                    image: data.data.release.artist.bannerImage.url,
                    name:
                        data.data.release.artist?.user?.displayName ||
                        data.data.release.artist.soundHandle,
                    twitterHandle: data.data.release.artist.user.twitterHandle,
                    address: data.data.release.artist.user.publicAddress,
                },
                schedules: [],
            };
        }

        return data;
    } catch (err) {
        console.log("error", err);

        return null;
    }
}
