import styled from "styled-components";

export const LoadingThumbnail = styled.a<{ isLight?: boolean }>`
    border-radius: 20px;
    background: ${({ isLight }) => (isLight ? "#f5f5f5" : "#131313")};
    border: 1px solid ${({ isLight }) => (isLight ? "#e9e9e9" : "#1b1b1b")};
    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.12);
    min-height: 280px;
    height: 100%;
    width: 100%;
    min-width: 100px;
    display: flex;
    justify-content: center;
    align-items: center;

    transition: 0.3s;
    cursor: pointer;
    border-radius: 8px;

    h1 {
        opacity: 0.4;
    }

    background-size: 800px 104px;
    position: relative;

    background: ${({ isLight }) => (isLight ? "#eee" : "#131313")};
    background: ${({ isLight }) =>
        isLight
            ? "linear-gradient(110deg, #ececec 8%, #f5f5f5 18%, #ececec 33%)"
            : "linear-gradient(110deg, #131313 8%, #1b1b1b 18%, #131313 33%)"};
    border-radius: 5px;
    background-size: 200% 100%;
    animation: 2s shine linear infinite;

    @keyframes shine {
        to {
            background-position-x: -200%;
        }
    }
`;
