import styled from "styled-components";
import { LoadingThumbnail } from "../../DesignSystem/cards/loading";
import ExhibitThumbnail from "../../DesignSystem/cards/ExhibitThumbnail";

export default function Spaces({ spaces, isLight, loadingSpaces }) {
    return (
        <Grid noGrid={!spaces.length && !loadingSpaces}>
            {loadingSpaces ? (
                <>
                    <LoadingThumbnail isLight={isLight} />
                    <LoadingThumbnail isLight={isLight} />
                    <LoadingThumbnail isLight={isLight} />
                </>
            ) : !spaces.length ? (
                <p>
                    {" "}
                    No public spaces found (if you're the owner and would like
                    to make a space public, simply set a title in your 3D
                    studio)
                </p>
            ) : (
                spaces?.map((exhibit, index) => {
                    if (!exhibit?.info?.headline) return null;
                    else console.log(exhibit?.info);
                    return <ExhibitThumbnail key={index} data={exhibit} />;
                })
            )}
        </Grid>
    );
}

const Grid = styled.div<{ noGrid: boolean }>`
    display: grid;
    grid-template-columns: ${({ noGrid }) => (noGrid ? "1fr" : "1fr 1fr 1fr")};
    width: 100%;
    grid-gap: 16px;
    padding-bottom: 40px;
    padding-top: 20px;
    grid-auto-rows: 1fr;

    & > p {
        padding: 120px 4px;
        text-align: center;
        max-width: 600px;
        margin: 0 auto;
        opacity: 0.5;
        font-size: 18px;
    }

    @media (max-width: 1100px) {
        grid-template-columns: 1fr 1fr;
    }

    @media (max-width: 600px) {
        grid-template-columns: 1fr;
    }
`;
