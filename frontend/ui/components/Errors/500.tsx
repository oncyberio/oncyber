import React, { forwardRef, CSSProperties } from "react";
import { StyledError } from "./styles";
import router from "next/router";
import Button from "../Button";
import Image from "next/legacy/image";

type NotFoundProps = React.HTMLAttributes<HTMLDivElement> & {
    style?: CSSProperties;
    message?: string | JSX.Element;
};

const ServerError = forwardRef(
    (props: NotFoundProps, ref: React.Ref<HTMLDivElement>) => {
        const redirect = () => router.push("/");

        const message = "Ooops! Something went wrong";

        return (
            <StyledError style={{ width: 500 }} ref={ref} {...props}>
                <Image src="/images/403.png" width="400" height="400" />
                {props.message && <div>{props.message}</div>}
                {!props.message && (
                    <div>
                        <span>[ERROR] {message}.</span>
                        <span>[ERROR] {message}.</span>
                        <span>[ERROR] {message}.</span>
                    </div>
                )}
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

ServerError.defaultProps = {};

export default ServerError;
