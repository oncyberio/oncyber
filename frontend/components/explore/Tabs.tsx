import React from "react";
import isEmpty from "lodash/isEmpty";
import styled from "styled-components";

export default function Tabs({
    search,
    radUser,
    isLight,
    isActive,
    setActive,
    searchLoading,
    items,
}) {
    return (
        <Container>
            {!isEmpty(search) && searchLoading ? (
                <div className="result">
                    <label>Results for : {search}</label>
                </div>
            ) : !isEmpty(radUser?.username) && !isEmpty(radUser?.walletId) ? (
                <div className="result">
                    <label>Results for : {radUser?.username}</label>
                </div>
            ) : (
                items.map((item, index) => (
                    <NavButton
                        key={index}
                        isLight={isLight}
                        active={isActive == item?.key}
                        onClick={() => setActive(item?.key)}
                    >
                        {item?.name}
                    </NavButton>
                ))
            )}
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-end;
    padding: 16px 0;

    & > .result {
        margin-top: 25px;
        margin-bottom: 10px;
        & > label {
            font-size: 20px;
            font-weight: 500;
        }
    }
`;

const NavButton = styled.div`
    text-align: center;
    border-radius: 50px;
    transition: 0.1s;
    margin-right: 24px;
    cursor: pointer;

    color: ${({ active, isLight }) =>
        active
            ? isLight
                ? "#000"
                : "#fff"
            : isLight
            ? "rgba(0, 0, 0, 0.3)"
            : "rgba(255, 255, 255, 0.3)"};
    font-size: 20px;
    font-weight: 500;

    display: flex;
    align-items: center;
    justify-content: center;

    img {
        width: 30px;
        margin-left: -10px;
    }

    &:hover {
        color: ${({ isLight }) => (isLight ? "#000" : "#fff")};
    }

    transition: 0.2s;

    @media (max-width: 550px) {
        font-size: 18px;
        margin-right: 8px;
    }
`;
