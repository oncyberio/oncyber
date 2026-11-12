import styled, { css } from "styled-components";

export const Container = styled.div`
    width: 100%;
    display: flex;
    margin-left: 4px;
    flex-direction: column;

    & > .folder {
        gap: 8px;
        width: 100%;
        display: flex;
        padding-right: 5px;
        padding-left: 18px;
        flex-direction: column;
    }
`;

export const Wrapper = styled.div`
    width: 100%;
    display: flex;
    cursor: pointer;
    align-items: center;
    justify-content: flex-start;

    & > span {
        font-size: 12px;
        color: #ffffff;
        font-weight: 500;
        margin-left: 8px;
        line-height: 24px;
    }
`;

export const FolderTab = styled.div`
    gap: 8px;
    display: flex;
    align-items: center;
    margin: 8px 0 0px 8px;
    justify-content: space-between;
`;

export const FolderBtn = styled.div<{ isActive?: boolean }>`
    width: 100%;
    border: none;
    outline: none;
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    font-size: 12px;
    line-height: 24px;

    ${(props) =>
        props.isActive
            ? css`
                  color: #ffffff;
                  background: #328dfd;
              `
            : css`
                  color: #ffffff;
                  background: #3d3f46;
              `}
`;
