import React from "react";
import styled from "styled-components";

export default function Terms() {
    return (
        <Container>
            <input type={"checkbox"} checked />
            <span>
                By proceeding to mint, you agree to our{" "}
                <a
                    href="https://docs.google.com/document/d/1hhlnPtkRQVJKvYx4Zr9bUzOuqWre9juI"
                    target={"_blank"}
                >
                    Terms of Service
                </a>
            </span>
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    flex-direction: row !important;
    justify-content: flex-start;
    margin-left: 15px;

    & > input {
        width: 16px;
        height: 16px;
    }

    & > span {
        font-weight: 400;
        font-size: 14px !important;
        line-height: 24px;
        color: #070707 !important;

        & > a {
            color: #000;
            font-weight: 500;
            text-decoration: underline;
        }
    }
`;
