import React from "react";
import styled, { css } from "styled-components";
import { RoundButton } from "@components/DesignSystem/buttons";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";
import { noop } from "@utils/js";
import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function Anon({ onConnect, style = {} }) {
    const { t } = useCyberTranslation();

    return (
        <Container style={style}>
            <Avatar>
                <LegacyCloudinaryNextImage
                    width={72}
                    height={72}
                    src={DEFAULT_PLAYER_AVATAR_PICTURE}
                    alt="Picture of the author"
                    objectFit="cover"
                    style={{ borderRadius: "999" }}
                    unoptimized
                />
            </Avatar>
            <Title>{t`ANON_TITLE`},</Title>
            <p>{t`ANON_DESCRIPTION`}</p>
            <RoundButton className="connect" onClick={onConnect}>
                {t`LOGIN`}
            </RoundButton>
        </Container>
    );
}

Anon.defaultProps = {
    onConnect: noop,
};

const Container = styled.div`
    width: 100%;
    height: 100%;
    padding: 32px;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;

    & > p {
        font-weight: 500;
        font-size: 12px;
        line-height: 120%;
        display: flex;
        align-items: center;
        text-align: center;
        color: #ffffff;
        opacity: 0.5;
        margin: 0;
        max-width: 203px;
    }

    & > .connect {
        margin-top: 20px;
    }
`;

const Avatar = styled.div`
    width: 72px;
    height: 72px;
    min-width: 72px;
    min-height: 72px;
    overflow: hidden;
    border-radius: 999px;
`;

const Title = styled.h2`
    font-weight: 500;
    font-size: 18px;
    line-height: 140%;
    display: flex;
    align-items: center;
    text-align: center;
    letter-spacing: -0.03em;
    color: #ffffff;
    margin-top: 8px;
    margin-bottom: 8px;
`;
