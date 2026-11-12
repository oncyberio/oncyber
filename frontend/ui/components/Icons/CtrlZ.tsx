import * as React from "react";

import CommandZ from "./CommandZ";
import { IS_FRONTEND_ENV } from "@utils/isFrontend";

const CtrlZ = (props) => {
    let isMac = false;

    if (IS_FRONTEND_ENV) {
        isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    }

    if (isMac) {
        return <CommandZ {...props} />;
    }

    const height = props.size ? props.size / 3 : 20;

    return (
        <svg
            width={props.size || "60px"}
            height={height}
            viewBox="0 0 77 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            {...props}
        >
            <path
                d="M0 5.714A5.714 5.714 0 0 1 5.714 0h27.572A5.714 5.714 0 0 1 39 5.714v12.572A5.714 5.714 0 0 1 33.286 24H5.714A5.714 5.714 0 0 1 0 18.286V5.714Z"
                fill={props.background || "#000"}
            />
            <path
                d="M10.417 16.072c1.956 0 3.384-1.152 3.648-2.928h-1.428c-.264 1.068-1.068 1.716-2.232 1.716-1.584 0-2.544-1.272-2.544-3.06 0-1.8.984-3.06 2.58-3.06 1.14 0 1.932.66 2.208 1.716h1.428c-.276-1.776-1.656-2.928-3.576-2.928-2.484 0-4.056 1.716-4.056 4.272 0 2.58 1.524 4.272 3.972 4.272ZM13.862 8.824h2.592V16h1.38V8.824h2.592V7.6h-6.564v1.224ZM21.073 16h1.38v-3.048H24.3L25.92 16h1.536l-1.776-3.348c.984-.348 1.632-1.248 1.632-2.376 0-1.632-1.176-2.676-2.928-2.676h-3.312V16Zm3.204-7.2c.984 0 1.62.576 1.62 1.476s-.636 1.476-1.62 1.476h-1.824V8.8h1.824ZM33.181 16v-1.224H29.57V7.6h-1.38V16h4.992ZM45.465 12.506H43.14v.966h2.324v2.464h1.05v-2.464h2.338v-.966h-2.338v-2.45h-1.05v2.45Z"
                fill={props.foreground || "#fff"}
            />
            <path
                d="M53 5.714A5.714 5.714 0 0 1 58.714 0h12.572A5.714 5.714 0 0 1 77 5.714v12.572A5.714 5.714 0 0 1 71.286 24H58.714A5.714 5.714 0 0 1 53 18.286V5.714Z"
                fill={props.background || "#000"}
            />
            <path
                d="M61.769 8.812h4.572l-4.704 6.24V16h6.72v-1.212H63.52l4.704-6.24V7.6h-6.456v1.212Z"
                fill={props.foreground || "#fff"}
            />
        </svg>
    );
};
export default CtrlZ;
