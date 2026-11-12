import { cloudinaryLoader, othersLoader } from "@utils/images/loader";
import styled, { CSSProperties } from "styled-components";
import { CloudinaryNextImage } from "@components/CloudinaryNextImage";

export interface AvatarProps {
    src: string;
    title?: string;
    size?:
        | "xlarge"
        | "largeplus"
        | "large"
        | "medium"
        | "small"
        | "smallplus"
        | "tiny"
        | "mediumplus";

    style?: CSSProperties;
    onerror?: any;
}

export const SIZES = {
    xlarge: 76,

    largeplus: 72,

    large: 56,

    medium: 42,

    mediumplus: 49,

    smallplus: 34,

    small: 24,

    tiny: 20,
};

export default function Avatar({
    src,
    title,
    size,
    style,
    onerror,
}: AvatarProps) {
    let width = 42;

    return (
        <Container
            className="ds-avatar"
            size={size}
            style={{
                ...style,
                width: SIZES[size],
                height: SIZES[size],
                minHeight: SIZES[size],
                minWidth: SIZES[size],
            }}
        >
            {src ? (
                <CloudinaryNextImage
                    alt={`${title} avatar`}
                    src={src}
                    quality="50"
                    width={SIZES["xlarge"]}
                    height={SIZES["xlarge"]}
                    style={{
                        objectFit: "cover",
                        visibility: "hidden",
                        width: "100%",
                        height: "100%",
                    }}
                    onLoadingComplete={(e) => {
                        e.style.visibility = "visible";
                    }}
                    onError={onerror}
                />
            ) : null}
        </Container>
    );
}

Avatar.defaultProps = {
    size: "medium",
    style: {},
};

// const Image = styled.img`
//     object-fit: cover;
//     border-radius: 50%;
// `;

const Container = styled.div<Partial<AvatarProps>>`
    border-radius: 50%;
    overflow: hidden;
    position: relative;
    width: 100%;
    height: 20px;
    background: linear-gradient(110deg, #e9e9e9 8%, #f5f5f5 18%, #e9e9e9 33%);
    background-size: 200% 100%;
    animation: 2s shine linear infinite;

    display: flex;
    align-items: center;
    justify-content: center;

    img[src=""] {
        visibility: hidden;
    }

    ${({ size }) => {
        if (size === "large") {
            return `

            `;
        }

        if (size === "medium") {
            return `

            `;
        }

        if (size === "small") {
            return `

            `;
        }
    }}
`;
