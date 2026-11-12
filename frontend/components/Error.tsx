import ExhibitThumbnail from "./DesignSystem/cards/ExhibitThumbnail/ExhibitThumbnail_B";
import { amplitude_logAnalyticsEvent } from "../utils/analytics";
import { useCyberTheme } from "./context/ThemeProvider";

import React, { useEffect, useState } from "react";
import ExhibitsLayout from "./layouts/exhibits";
import styled from "styled-components";
import { nodeEnv } from "@env";
import dynamic from "next/dynamic";

const Error = dynamic(() => import("@ui/components/Errors"));

const Forbidden = dynamic(() => import("@ui/components/Errors/403"));

const NotFound = dynamic(() => import("@ui/components/Errors/404"));

const PageError = ({ statusCode, forbidError = null }) => {
    const [_loading, setLoading] = useState(false);
    const [exhibits, setExhibits] = useState([]);
    const { isLightTheme } = useCyberTheme();

    let message = "There has been an error";

    if (statusCode == 77) {
        message = "We had a hard time running 3D on your browser.";
    }

    const getExhibits = async () => {
        setLoading(true);
        try {
            // relative on purpose: PUBLIC_API points at the deployment url,
            // which differs from the branch-alias origin on previews → CORS
            const data = await (
                await fetch(
                    `/api/exhibit?type=FETCH_ALL_EXHIBITS&isActive=most-visited`
                )
            ).json();
            setExhibits(data.exhibits);
            setLoading(false);
        } catch (e) {
            setLoading(false);
        }
    };

    useEffect(() => {
        amplitude_logAnalyticsEvent("viewed_error", {
            statusCode,
            message,
        });
        if (statusCode != 77) getExhibits();
    }, []);

    if (statusCode == 77) {
        return (
            <Container>
                <Headline style={{ padding: 0 }}>
                    <h3>We had a hard time running 3D on your browser 😐</h3>
                    <h5>A few things that may help:</h5>
                    <p>- Enable WebGL</p>
                    <p>- Enable Hardware Acceleration</p>
                    <p>
                        - CPU or GPU load is too high. Try closing some
                        applications and browser tabs and refresh the page
                    </p>
                    <p>
                        - <img src="../images/icons/discord.png" /> Hop on our{" "}
                        <a href="https://discord.gg/MHcMuG66Mw">Discord</a> so
                        we can assist better!
                    </p>
                </Headline>
            </Container>
        );
    }

    return (
        <ExhibitsLayout
            isActive="Login"
            onLogin={console.log}
            isLight={isLightTheme}
            setLightMode={() => {}}
        >
            <Container>
                {statusCode === 403 ? (
                    <Forbidden message={forbidError} />
                ) : statusCode === 404 ? (
                    <NotFound />
                ) : (
                    <Error />
                )}
                <Body>
                    {exhibits.length == 0 ? (
                        <></>
                    ) : (
                        <>
                            <br />
                            <Exhibits>
                                {exhibits.map((exhibit, idx) => (
                                    <ExhibitThumbnail
                                        key={exhibit?.id || idx}
                                        isLanding
                                        data={exhibit}
                                        showCreatorImage={false}
                                        source="404"
                                        style={{}}
                                    />
                                ))}
                            </Exhibits>
                        </>
                    )}
                </Body>
            </Container>
        </ExhibitsLayout>
    );
};

const Container = styled.div`
    min-height: calc(100vh - 60px);
    background-color: ${({ theme }) =>
        `${theme.type === "dark" ? "#000" : "#fff"}`};
    color: ${({ theme }) => `${theme.type === "dark" ? "#fff" : "#000"}`};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    max-width: 1260px;
    margin: 0 auto;
    padding-top: 250px;

    @media (max-width: 800px) {
        align-items: flex-start;
        padding: 16px;
    }
`;

const Headline = styled.div`
    padding: 16px;
    padding-top: 250px;

    & > h3 {
        font-size: 32px;
        font-weight: 600;
    }

    h3,
    p {
        margin: 0;
    }

    h5 {
        font-size: 24px;
        font-weight: 500;
    }

    p {
        margin-top: 8px;
        font-size: 20px;

        a {
            text-decoration: underline;
        }
    }

    img {
        width: 16px;
        margin: 0 8px;
    }

    @media (max-width: 800px) {
        padding: 24px;
        padding-top: 150px;
        h3 {
            font-size: 24px;
        }
    }
`;

const Body = styled.div`
    width: 100%;
    min-height: 100vh;
    max-width: 1260px;
    margin: 0 auto;
    padding: 32px 32px 120px 32px;

    @media (max-width: 800px) {
        padding: 24px 16px;
    }
`;

const Exhibits = styled.div`
    display: grid;
    margin-top: 8px;
    grid-gap: 12px;
    grid-template-columns: 1fr 1fr 1fr;

    @media (max-width: 1300px) {
        grid-template-columns: 1fr 1fr;
    }

    @media (max-width: 800px) {
        grid-template-columns: 1fr;
    }
`;

export default PageError;
