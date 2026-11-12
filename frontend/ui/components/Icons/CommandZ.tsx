import * as React from "react";
import CtrlZ from "./CtrlZ";
import { IS_FRONTEND_ENV } from "@utils/isFrontend";

const CommandZ = (props) => {
    let isMac = false;

    if (IS_FRONTEND_ENV) {
        isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    }

    if (!isMac) {
        return <CtrlZ {...props} />;
    }

    const height = props.size ? props.size / 3 : 20;

    return (
        <svg
            width={props.size || "60px"}
            height={height}
            viewBox="0 0 62 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            {...props}
        >
            <path
                d="M0 5.714A5.714 5.714 0 0 1 5.714 0h12.572A5.714 5.714 0 0 1 24 5.714v12.572A5.714 5.714 0 0 1 18.286 24H5.714A5.714 5.714 0 0 1 0 18.286V5.714Z"
                fill={props.background || "#000"}
            />
            <path
                d="M15.667 6a2.336 2.336 0 0 0-2.334 2.333v1h-2.666v-1A2.336 2.336 0 0 0 8.333 6 2.336 2.336 0 0 0 6 8.333a2.336 2.336 0 0 0 2.333 2.334h1v2.666h-1A2.336 2.336 0 0 0 6 15.667 2.336 2.336 0 0 0 8.333 18a2.336 2.336 0 0 0 2.334-2.333v-1h2.666v1A2.336 2.336 0 0 0 15.667 18 2.336 2.336 0 0 0 18 15.667a2.336 2.336 0 0 0-2.333-2.334h-1v-2.666h1A2.336 2.336 0 0 0 18 8.333 2.336 2.336 0 0 0 15.667 6Zm-1 3.333v-1c0-.553.446-1 1-1 .553 0 1 .447 1 1 0 .554-.447 1-1 1h-1Zm-6.334 0c-.553 0-1-.446-1-1 0-.553.447-1 1-1 .554 0 1 .447 1 1v1h-1Zm2.334 4v-2.666h2.666v2.666h-2.666Zm5 3.334c-.554 0-1-.447-1-1v-1h1c.553 0 1 .446 1 1 0 .553-.447 1-1 1Zm-7.334 0c-.553 0-1-.447-1-1 0-.554.447-1 1-1h1v1c0 .553-.446 1-1 1ZM30.465 12.506H28.14v.966h2.324v2.464h1.05v-2.464h2.338v-.966h-2.338v-2.45h-1.05v2.45Z"
                fill={props.foreground || "#fff"}
            />
            <path
                d="M38 5.714A5.714 5.714 0 0 1 43.714 0h12.572A5.714 5.714 0 0 1 62 5.714v12.572A5.714 5.714 0 0 1 56.286 24H43.714A5.714 5.714 0 0 1 38 18.286V5.714Z"
                fill={props.background || "#000"}
            />
            <path
                d="M46.769 8.812h4.572l-4.704 6.24V16h6.72v-1.212H48.52l4.704-6.24V7.6h-6.456v1.212Z"
                fill={props.foreground || "#fff"}
            />
        </svg>
    );
};

export default CommandZ;
