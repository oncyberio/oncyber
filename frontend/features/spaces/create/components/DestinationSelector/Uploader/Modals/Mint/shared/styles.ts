import styled from "styled-components";

export const Details = styled.div`
    padding: 12px 32px 0px 32px;

    & > h1 {
        font-weight: 500;
        font-size: 25px;
        color: #18191c;
        line-height: 28px;
        margin-bottom: 5px;
        padding-bottom: 0px;

        @media (max-width: 800px) {
            font-size: 22px;
        }
    }

    & > p {
        font-weight: 400;
        font-size: 14px;
        color: #777980;
        margin: 0 0 20px 0;

        @media (max-width: 800px) {
            font-size: 14px;
        }

        & > a {
            color: #070707;
            text-decoration: underline;
        }
    }

    & > div {
        display: flex;
        margin-bottom: 20px;
        flex-direction: column;

        & > label {
            font-size: 14px;
            font-weight: 500;
            color: #3d3f46;
            line-height: 31px;

            @media (max-width: 800px) {
                font-size: 12px;
            }
        }

        & > span {
            font-weight: 400;
            line-height: 6px;
            font-size: 12px;
            color: #777980;

            @media (max-width: 800px) {
                font-size: 10px;
            }

            & > a {
                text-decoration: underline;
            }
        }

        & > .error {
            font-size: 12px;
            color: #ff413f;
            padding-top: 8px;

            @media (max-width: 800px) {
                font-size: 10px;
            }
        }
    }
`;

export const RadioGroup = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-top: 10px;
`;

export const Footer = styled.footer`
    display: flex;
    padding: 25px;
    margin-top: 30px;
    justify-content: flex-end;
    border-top: 1.5px solid #e0e0e0;

    & > button {
        font-size: 15px;
        font-weight: 500;
        line-height: 24px;
        margin-left: 16px;

        @media (max-width: 800px) {
            font-size: 13px;
        }

        &.cancel,
        &.back {
            color: #070707;
            background: transparent;
            border: 1px solid #dfdfe4;
        }

        &:disabled {
            color: #fff;
            background: #e0e0e0;
        }

        &.submit {
            color: #ffffff;
            background: #070707;
        }
    }
`;

export const Table = styled.div`
    width: 100%;
    padding-top: 15px;
    border-top: 1px solid #dfdfe4;

    & > tr {
        width: 100%;
        height: 50px;
        display: flex;
        padding: 20px;
        align-items: center;
        justify-content: space-between;

        &.description {
            height: auto;
            max-height: 200px;
            padding: 20px;
            align-items: flex-start;

            td {
                height: auto;
                max-width: 250px;

                & > p {
                    max-height: 120px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    font-weight: 500;
                    font-size: 14px;
                    text-align: left;
                    padding: 0px;
                    margin: 0px;
                    color: #3d3f46;
                    filter: initial;

                    & > a {
                        cursor: pointer;
                        font-size: 12px;
                        text-decoration: underline;
                    }

                    &::-webkit-scrollbar {
                        width: 5px;
                        border-top-right-radius: 8px;
                        border-bottom-right-radius: 8px;
                    }

                    &::-webkit-scrollbar {
                        background: #ffffff;
                    }

                    &::-webkit-scrollbar-track {
                        margin-top: 10px;
                        margin-bottom: 10px;
                    }

                    &::-webkit-scrollbar-thumb {
                        width: 5px;
                        border-radius: 8px;
                        background: #dadada;
                    }

                    @media (max-width: 800px) {
                        font-size: 12px;
                    }
                }

                & > div {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;

                    & > span {
                        cursor: pointer;
                        font-size: 12px;
                        margin-left: 10px;
                        margin-top: 10px;

                        &:last-child {
                            text-decoration: underline;
                        }
                    }
                }
            }
        }

        &:nth-child(odd) {
            background: transparent;

            .duplicate {
                background: #fff;
            }
        }

        &:nth-child(even) {
            background: #f7f7fa;

            .duplicate {
                background: #f7f7fa;
            }
        }

        a {
            cursor: pointer;
        }

        & > th {
            font-weight: 400;
            font-size: 14px;
            line-height: 24px;
            color: #777980;

            @media (max-width: 800px) {
                font-size: 12px;
                text-align: left;
            }
        }

        & > td {
            font-weight: 500;
            font-size: 14px;
            line-height: 24px;
            text-align: right;
            color: #3d3f46;
            max-width: 250px;
            overflow: hidden;
            position: relative;

            @media (max-width: 800px) {
                font-size: 12px;
            }

            .duplicate {
                position: absolute;
                right: 0;
                top: 0;
                cursor: pointer;
            }

            &.link {
                cursor: pointer;
            }
        }
    }
`;
