import * as React from "react";
const SArrowUp = (props) => (
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
        <path d="m8 15 4.5-5 4.5 5" fill={props.foreground || "#fff"} />
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M7.315 15.305A.75.75 0 0 0 8 15.75h9a.75.75 0 0 0 .558-1.252l-4.5-5a.75.75 0 0 0-1.115 0l-4.5 5a.75.75 0 0 0-.128.807Zm2.369-1.055 2.816-3.129 2.816 3.129H9.684Z"
            fill={props.foreground || "#fff"}
        />
    </svg>
);
export default SArrowUp;
