import React from "react";

function ChevronLeft({ stoke = "#A7A7A7", ...props }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 6 8"
            {...props}
        >
            <path
                stroke={stoke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M4.5 1l-3 3 3 3"
            ></path>
        </svg>
    );
}

export default ChevronLeft;
