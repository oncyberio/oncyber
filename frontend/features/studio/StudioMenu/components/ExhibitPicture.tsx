import { Experience } from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";
import React from "react";
import styled from "styled-components";
import { exhibitCover } from "@utils/destinationCover";

export type ExhibitPictureProps = React.ComponentPropsWithoutRef<"div"> & {
    exhibit: Experience;
    destination?: RoomParameters;
};

export const ExhibitPicture = React.forwardRef(
    (
        {
            exhibit,
            destination,
            style = {},
            className = "",
            onClick = null,
        }: ExhibitPictureProps,
        ref: React.Ref<HTMLDivElement>
    ) => {
        //

        return (
            <Container
                ref={ref}
                style={style}
                className={className}
                onClick={onClick}
            >
                <img
                    src={exhibitCover(exhibit?.info, destination)}
                    alt="Exhibit picture"
                    onError={(e: any) => {
                        e.target.src = "/images/sq_image_placeholder.png";
                        e.target.onerror = null;
                    }}
                />
            </Container>
        );
    }
);

const Container = styled.div`
    overflow: hidden;
    border-radius: 2px;

    & > img {
        object-fit: cover;
        width: 100%;
        height: 100%;
    }
`;
