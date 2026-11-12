import { NButton } from "@features/studio/components/StudioButton";
import styled from "styled-components";

export const Footer = styled.div`
    width: 100%;
    display: flex;
    padding-top: 20px;
    padding: 24px;
    margin-top: 32px;
    align-items: center;
    justify-content: flex-end;
    border-top: 1px solid #292929;

    position: sticky;
    bottom: 0;

    @media (max-width: 830px) {
        // display: none;
    }

    & > button {
        span {
            text-align: center;
            margin: 0;
        }

        &.cancel {
            justify-content: center;
            width: 90px;
            background: transparent;
            color: #c0c0c6;
        }

        &.cancel:disabled {
            cursor: progress;
            opacity: 0.5;
        }

        &.save {
            text-align: center;
            // margin-left: 8px;
            // padding: 5px 2px 5px 15px;
        }

        // &.destination {
        //     width: 159px;
        //     font-weight: 500;
        //     font-size: 14px;
        //     text-align: center;
        //     line-height: 24px;
        //     padding: 5px 2px 5px 24px;
        // }
    }
`;
