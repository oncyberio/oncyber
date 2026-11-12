import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";
import { ForwardedRef, forwardRef } from "react";
import { CSSProperties } from "styled-components";

interface IconImgProps {
    size?: number;
    name: string;
    mode?: "dark" | "light";
    style?: CSSProperties;
    className?: string;
    title?: string;
    onClick?: (e: React.MouseEvent) => unknown;
}

const IconImg = forwardRef(
    (props: IconImgProps, ref: ForwardedRef<HTMLDivElement>) => {
        //
        const style = {
            width: props.size,
            height: props.size,
            minHeight: props.size,
            minWidth: props.size,
            display: "flex",
            ...props.style,
        };

        if (props.onClick) {
            style.cursor = "pointer";
        }

        return (
            <div
                style={style}
                ref={ref}
                className={props.className || "icon-img"}
                title={props.title}
                onClick={props.onClick || null}
            >
                <LegacyCloudinaryNextImage
                    unoptimized
                    alt={`${props.name} icon`}
                    src={`/icons/${props.name}.svg`}
                    height={props.size}
                    width={props.size}
                    style={{
                        filter:
                            props.mode === "dark" ? "invert(0)" : "invert(1)",
                    }}
                />
            </div>
        );
    }
);

IconImg.defaultProps = {
    size: 24,
    mode: "dark",
    name: "activity",
};

export default IconImg;
