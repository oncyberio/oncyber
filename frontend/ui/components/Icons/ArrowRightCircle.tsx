import * as React from "react";

const ArrowRightCircle = (props) => (
    <svg
        width={props.size || "1em"}
        height={props.size || "1em"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={props.style || {}}
    >
        <path
            d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
            stroke={props.fill || "#000"}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="m12 16 4-4-4-4M8 12h8"
            stroke={props.fill || "#000"}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default ArrowRightCircle;
