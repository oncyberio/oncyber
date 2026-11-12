import * as React from "react";
const SArrowDown = (props) => (
    <svg
        width={props.size || "1em"}
        height={props.size || "1em"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        {...props}
    >
        <path
            d="M0 5.714A5.714 5.714 0 0 1 5.714 0h12.572A5.714 5.714 0 0 1 24 5.714v12.572A5.714 5.714 0 0 1 18.286 24H5.714A5.714 5.714 0 0 1 0 18.286V5.714Z"
            fill={props.background || "#000"}
        />
        <path d="m17 10-5 5-5-5" fill={props.foreground || "#fff"} />
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11.47 15.53a.75.75 0 0 0 1.06 0l5-5A.75.75 0 0 0 17 9.25H7a.75.75 0 0 0-.53 1.28l5 5Zm-2.66-4.78h6.38L12 13.94l-3.19-3.19Z"
            fill={props.foreground || "#fff"}
        />
    </svg>
);
export default SArrowDown;
