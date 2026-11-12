import React, { forwardRef, CSSProperties } from "react";
import { StyledError } from "./styles";
import router from "next/router";
import Button from "../Button";
import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";

type NotFoundProps = React.HTMLAttributes<HTMLDivElement> & {
    style?: CSSProperties;
};

const Error = forwardRef(
    (props: NotFoundProps, ref: React.Ref<HTMLDivElement>) => {
        const redirect = () => router.push("/");

        return (
            <StyledError ref={ref} {...props}>
                <LegacyCloudinaryNextImage
                    unoptimized
                    src="/images/Error.png"
                    width="500"
                    height="500"
                />
                <div>
                    <span>[ERROR] There has been an error</span>
                    <span>[ERROR] There has been an error</span>
                    <span>[ERROR] There has been an error</span>
                </div>
                <Button
                    onClick={redirect}
                    title="TAKE ME HOME"
                    size={"medium"}
                />
            </StyledError>
        );
    }
);

Error.defaultProps = {};

export default Error;
