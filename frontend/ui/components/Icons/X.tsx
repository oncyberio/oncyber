import * as React from "react";

const X = (props) => (
    <svg
        width={props.size || "1em"}
        height={props.size || "1em"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <path
            d="M18 6 6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default X;
