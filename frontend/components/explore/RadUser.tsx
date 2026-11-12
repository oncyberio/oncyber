import styled from "styled-components";
import Creator from "@components/Creator";

const radUsers = [
    {
        username: "6529",
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-dev-3f2ee.appspot.com/o/profiles%2F0x3d055040d91414fbdc0a9eb0cb4e1bdf222fb1e1%2Favatar?alt=media&token=2e7383bb-1f4c-41af-b8f5-7dbca8635bd3",
        address: "0xfd22004806a6846ea67ad883356be810f0428793",
    },
    {
        username: "dingaling",
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-dev-3f2ee.appspot.com/o/profiles%2F0x76db02500f7631d57bc2dcdca9d4cf782b99e119%2Favatar?alt=media&token=e2d99c68-985b-4339-b065-0eea9b5bb219",
        address: "0x54be3a794282c030b15e43ae2bb182e14c409c5e",
    },
    {
        username: "benit0",
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-dev-3f2ee.appspot.com/o/profiles%2F0xc79412ab7cfab0347d0a1257a95291cf55564ff6%2Favatar?alt=media&token=cfec4d15-b1c6-4029-a106-220447e1bba8",
        address: "0xc67c60cd6d82fcb2fc6a9a58ea62f80443e32683",
    },
    {
        username: "VinceVanDough",
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-dev-3f2ee.appspot.com/o/profiles%2F0xf02cb30a8963e6fe8cc7650a6169e603357650ad%2Favatar?alt=media&token=d760472d-5c70-4eed-a461-cfad8a99104b",
        address: "0x0f0eae91990140c560d4156db4f00c854dc8f09e",
    },
    {
        username: "Coco__Bear",
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-dev-3f2ee.appspot.com/o/profiles%2F0xf02cb30a8963e6fe8cc7650a6169e603357650ad%2Favatar?alt=media&token=d760472d-5c70-4eed-a461-cfad8a99104b",
        address: "0xfd113ce2c7d6fee4a6fa9a282aabfc32eca5509c",
    },
    {
        username: "rayan",
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-dev-3f2ee.appspot.com/o/profiles%2F0x76db02500f7631d57bc2dcdca9d4cf782b99e119%2Favatar?alt=media&token=e2d99c68-985b-4339-b065-0eea9b5bb219",
        address: "0x76db02500f7631d57bc2dcdca9d4cf782b99e119",
    },
];

export default function RadUser({ isLight, setRadUser }) {
    return (
        <RadUsers isLight={isLight}>
            <label>Some rad creators you should check out</label>
            <div>
                {radUsers.map(({ address, username }, index) => (
                    <div key={index}>
                        <Creator
                            style={{
                                background: "transparent",
                            }}
                            onClick={() =>
                                setRadUser({
                                    username,
                                    walletId: address,
                                })
                            }
                            showImage={true}
                            creator={{ id: address }}
                        />
                    </div>
                ))}
            </div>
        </RadUsers>
    );
}

const RadUsers = styled.div`
    display: flex;
    flex-direction: column;
    margin: 40px auto;
    max-width: 700px;

    & > label {
        font-size: 0.9rem;
        font-weight: 400;
        color: ${({ active, isLight }) =>
            active
                ? isLight
                    ? "#000"
                    : "#fff"
                : isLight
                ? "rgba(0, 0, 0, 0.3)"
                : "rgba(255, 255, 255, 0.455)"};
    }

    & > div {
        overflow-y: auto;
        -ms-overflow-style: none; /* IE and Edge */
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }

        display: flex;
        justify-content: flex-start;
        justify-items: center;
        margin-top: 16px;

        & > div {
            display: flex;
            flex-direction: row;
            margin-right: 2rem;
            color: ${({ isLight }) =>
                isLight ? "rgba(0, 0, 0, 0.7)" : "rgba(255, 255, 255, 0.75)"};
            &:hover {
                color: ${({ isLight }) => (isLight ? "#070707" : "#fff")};
            }
        }
    }
`;
