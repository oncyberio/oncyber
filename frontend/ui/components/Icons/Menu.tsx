import * as React from "react";

const Menu = (props) => (
    <svg
        width={props.size || "1em"}
        height={props.size || "1em"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <path
            d="M3 12h18M3 6h18M3 18h18"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default Menu;
