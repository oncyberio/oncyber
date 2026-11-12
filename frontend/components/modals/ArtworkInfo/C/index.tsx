import {
    ThemeProvider as StyledThemeProvider,
    withTheme,
} from "styled-components";
import React from "react";
import { brandTokens as brand } from "@styles/brand/tokens";
import pageDark from "@ui/theme/themes/dark";

import { ArtworkInfoProps } from "../types";
import NativeArtworkInfo from "../D";
import { ArtworkInfo_Full } from "./ArtworkInfo_Full";
import { ArtworkInfoMint_3D } from "./ArtworkInfoMint_3D";
import { ArtworkInfoProvider } from "./components/ArtworkContext";

import { dark } from "./theme/dark";

/**
 * The artwork window is dark on every page, like the shared dialog: the
 * page's dark theme (so parts that read the theme type, icon filters and
 * borders draw for a dark surface), the artwork dark set, and the panel
 * material and ink.
 */
export const artworkWindowTheme = (pageTheme: any) => ({
    ...pageTheme,
    ...pageDark,
    ...dark,
    color: brand.color.ink,
    background: brand.color.panel,
});

const ArtworkInfo: React.FC<ArtworkInfoProps & { theme: any }> = (props) => {
    if (!props.isShowing || props.artwork == null) return null;

    if (props.type === "3d" && !props.artwork.mintable)
        return <NativeArtworkInfo {...props} />;

    const Artwork = props.type === "3d" ? ArtworkInfoMint_3D : ArtworkInfo_Full;

    return (
        <StyledThemeProvider theme={artworkWindowTheme(props.theme)}>
            <ArtworkInfoProvider {...props}>
                <Artwork {...props} />
            </ArtworkInfoProvider>
        </StyledThemeProvider>
    );
};

export default withTheme(ArtworkInfo);
