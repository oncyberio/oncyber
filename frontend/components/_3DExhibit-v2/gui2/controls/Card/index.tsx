import { classes } from "@utils/js";
import { CSSProperties } from "react";
import styled from "styled-components";

export function Card({
    image,
    alt = "",
    label = null,
    selected = false,
    disabled = false,
    onClick = null,
}) {
    //

    return (
        <CardContainer
            className={classes({ disabled, selected })}
            onClick={onClick}
        >
            <div className="card-wrapper">
                <div className="img-wrapper">
                    <img src={image} title={alt} />
                </div>
            </div>
            {label && <label className="label">{label}</label>}
        </CardContainer>
    );
}

export const CardContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;

    &.disabled {
        opacity: 0.3;
        pointer-events: none;
        cursor: not-allowed;
    }

    &.selected > .card-wrapper > .img-wrapper {
        border: 2px solid #328dfd;
    }

    & > .card-wrapper {
        &:hover {
            & > .img-wrapper {
                border: 2px solid #328dfd;
            }
        }

        & > .img-wrapper {
            position: relative;
            height: 48px;
            width: 48px;
            border-radius: 6px;
            overflow: hidden;

            & > img {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
        }
    }

    & > .label {
        width: 100%;
        text-align: center;
        color: #999999;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-style: normal;
        font-weight: 400;
        font-size: 12px;
    }
`;
