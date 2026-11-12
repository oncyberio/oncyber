import styled from "styled-components";
import { baseTokens as base, landingTokens as landing } from "@styles/tokens";

// The account dashboard is dark on every page (see ../../index.tsx).

export const Container = styled.div`
    --provider-buttons-border-color: ${base.color.line.hover};
    --provider-buttons-font-color: var(--title-color);
    /* The wallet buttons keep their pale hover fill. */
    --provider-buttons-font-hover-color: ${landing.color.paperInk};
    color: var(--title-color);

    padding-top: 0px;

    p {
        font-weight: 500;
        font-size: 12px;
        margin: 0;
    }
`;

export const ProviderWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid ${base.color.line.default};
    border-radius: 8px;
    padding: 7px 14px;
    margin-bottom: 4px;

    & > div {
        display: flex;
        gap: 16px;
        align-items: center;
    }

    p {
        font-weight: 500;
        font-size: 12px;

        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 15em;

        line-height: 24px;
    }
`;

export const WalletProviderButton = styled.button`
    width: 100%;
    padding: 10px;
    border: 1px dashed ${base.color.line.hover};
    border-radius: 8px;
    font-weight: 500;
    font-size: 12px;
    background: none;
    color: var(--title-color);
    cursor: pointer;
    &:hover:not(:disabled) {
        border-color: ${base.color.line.selected};
    }
    &:focus-visible {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: 2px;
    }
`;

export const ButtonsWrapper = styled.div`
    margin-top: 24px;

    display: flex;
    justify-content: space-between;
    gap: 12px;
`;

export const Error = styled.p`
    margin-bottom: 18px;
    color: var(--danger-color);
    margin-top: 0;
`;

export const UsersWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 24px;
`;

export const UserWrapper = styled.div<{
    isActive: boolean;
}>`
    display: flex;
    cursor: pointer;
    border: 1px solid ${base.color.line.default};

    ${(props) =>
        props.isActive && `border: 1px solid ${base.color.line.selected};`}

    border-radius: 8px;
    padding: 12px;
    align-items: center;
    justify-content: space-between;

    .userwrapper_avatar_wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .userwrapper_username {
        max-width: 11em;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

export const MetadatasWrapper = styled.div`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
`;

export const MetadataWrapper = styled.div`
    background: ${landing.color.surface};
    border-radius: 900px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    justify-content: center;

    .icon-img {
        display: flex;
    }
`;
