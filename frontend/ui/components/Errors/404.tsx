import React, { forwardRef, CSSProperties } from "react";
import { StyledError } from "./styles";
import router from "next/router";
import Button from "../Button";
import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";

type NotFoundProps = React.HTMLAttributes<HTMLDivElement> & {
    style?: CSSProperties;
};

const NotFound = forwardRef(
    (props: NotFoundProps, ref: React.Ref<HTMLDivElement>) => {
        const redirect = () => router.push("/");

        return (
            <StyledError ref={ref} {...props}>
                <LegacyCloudinaryNextImage
                    unoptimized
                    src="/images/404.png"
                    width="500"
                    height="500"
                />
                <div>
                    <span>[404] Whoops, that page is gone.</span>
                    <span>[404] Whoops, that page is gone.</span>
                    <span>[404] Whoops, that page is gone.</span>
                </div>
                <Button
                    onClick={redirect}
                    title="TAKE ME HOME"
                    color="#fff"
                    bg="#000000"
                    size={"medium"}
                />
            </StyledError>
        );
    }
);

NotFound.defaultProps = {};

export default NotFound;
