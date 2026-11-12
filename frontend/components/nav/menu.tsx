import styled from "styled-components";
import Link from "next/link";

export default function Menu({ userData, isLight, setLightMode }) {
    return (
        <Container isLight={isLight}>
            <Section2 isLight={isLight}>
                <span>MAIN NAVIGATION</span>

                <Link href="/">
                    <h1>Home</h1>
                </Link>
                <Link href="/studio">
                    <h1>Create</h1>
                </Link>
                <Link href="/">
                    <h1>Feed</h1>
                </Link>
                <Link href="/docs" target="_blank">
                    <h1>About</h1>
                </Link>
                <Link href="https://docs.oncyber.io/faq" target="_blank">
                    <h1>FAQ</h1>
                </Link>
            </Section2>
            <Section3 isLight={isLight}>
                <span>ACCOUNT</span>
                {userData?.id ? (
                    <>
                        <Link href={`/@${userData?.username || userData?.id}`}>
                            <p>Profile</p>
                        </Link>
                        <Link href="/studio">
                            <p>World Builder</p>
                        </Link>
                    </>
                ) : (
                    <>
                        <Link href="/studio">
                            <p>Create an Account</p>
                        </Link>
                    </>
                )}
                <div>
                    <div>
                        <span>PLATFORMS</span>
                        <Link
                            href="https://opensea.io/category/oncyber"
                            target="_blank"
                        >
                            <p>Opensea</p>
                        </Link>
                        <Link
                            href="https://github.com/oncyberio/factory"
                            target="_blank"
                        >
                            <p>Github</p>
                        </Link>
                    </div>
                    <div>
                        <span>SOCIAL MEDIA</span>
                        <Link
                            href="https://twitter.com/oncyber"
                            target="_blank"
                        >
                            <p>Twitter</p>
                        </Link>
                        <Link
                            href="https://instagram.com/oncyber"
                            target="_blank"
                        >
                            <p>Instagram</p>
                        </Link>
                    </div>
                    <div>
                        <span>LEGAL</span>
                        <Link
                            href="https://docs.oncyber.io/tos"
                            target="_blank"
                        >
                            <p>Terms and conditions</p>
                        </Link>
                    </div>
                </div>
            </Section3>
            <Section1>
                <Logo
                    className="invertColor"
                    src="https://cyber.mypinata.cloud/ipfs/QmPHu1m1KAeR3BaeGQBfsPyn1uw6bwPqoygW5Mnpj6spoQ?filename=headline-2_yu6vjt.svg"
                />
                {/* <div onClick={() => setLightMode(!isLight)}>
                    <LightSwitch
                        className="invertColor"
                        src="/v2/icons/lightmode.svg"
                    />
                    <p>{isLight ? "Dark" : "Light"} Color Theme</p>
                </div> */}
            </Section1>
        </Container>
    );
}

const Container = styled.div<{ isLight: boolean }>`
    display: grid;
    grid-template-columns: 4fr 4fr 3fr;
    align-items: center;
    color: ${({ isLight }) => (isLight ? "#000" : "#fff")};
    width: 100%;
    // -webkit-box-shadow: 1px 1px 5px 10000px rgba(0,0,0,0.5);
    // -moz-box-shadow: 1px 1px 5px 10000px rgba(0,0,0,0.75);
    // box-shadow: 1px 1px 5px 10000px rgba(0,0,0,0.75 );

    .invertColor {
        filter: ${({ isLight }) =>
            isLight ? "invert(1)" : "invert(0)"} !important;
    }
    padding: 0px;

    & > div {
        height: 100%;
        padding: 80px 64px;
        span {
            font-size: 12px;
            opacity: 0.6;
        }
        // border-right: 1px solid #4d4d4d;
    }

    @media (max-width: 900px) {
        grid-template-columns: 4fr 4fr;
    }

    @media (max-width: 600px) {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }
`;

const Section1 = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-right: 0 !important;
    padding: 80px 48px !important;
    padding-right: 0 !important;
    align-items: flex-end !important;

    & > div {
        display: flex;
        align-items: center;
        cursor: pointer;

        p {
            margin-left: 8px;
        }
    }

    a {
        color: inherit !important;
    }

    @media (max-width: 600px) {
        // display: none;
        border: 0 !important;
        justify-content: space-between;
        align-items: flex-start !important;

        img {
            max-width: 200px;
        }
        padding: 48px 16px !important;
    }
`;

const Section2 = styled.div<{ isLight: boolean }>`
    display: flex;
    flex-direction: column;
    // align-items: center;
    justify-content: flex-start;
    margin-top: 16px;
    padding: 80px 0 !important;

    h1 {
        font-weight: 600;
        font-size: 72px;
        margin: 0 0 16px 0;
        cursor: pointer;

        &:hover {
            color: ${({ isLight }) =>
                isLight ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"};
        }

        @media (max-width: 1200px) {
            font-size: 60px;
        }
    }

    a {
        color: inherit !important;
    }

    @media (max-width: 600px) {
        h1 {
            font-size: 56px;
        }
        padding: 80px 16px 32px 16px !important;
    }
`;
const Section3 = styled.div<{ isLight: boolean }>`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    margin-top: 16px;
    font-size: 22px;
    padding: 80px 32px !important;

    @media (max-width: 900px) {
        display: none;
    }

    p {
        color: ${({ isLight }) => (isLight ? "#000" : "#fff")};

        &:hover {
            color: ${({ isLight }) =>
                isLight ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"};
        }
    }

    & > div {
        padding: 80px 0px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        justify-content: space-between;
        color: inherit;

        & > div {
            padding: 16px 0;
        }
    }

    p {
        margin: 16px 0;
        margin-top: 8px;
        cursor: pointer;
    }
`;

const Logo = styled.img`
    max-width: 100%;
    margin-top: 16px;
`;

const LightSwitch = styled.img`
    margin-right: 8px;
    width: 20px;
    cursor: pointer;

    &:hover {
        opacity: 0.8;
    }
`;
