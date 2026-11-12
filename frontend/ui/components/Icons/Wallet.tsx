import * as React from "react";

const Wallet = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={21}
        height={18}
        fill="none"
        {...props}
    >
        <path
            stroke={props.color || "#000"}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M1.333 3.667h16A2.667 2.667 0 0 1 20 6.333v8A2.667 2.667 0 0 1 17.333 17H4a2.667 2.667 0 0 1-2.667-2.667V3.667Zm0 0H16V2.333A1.333 1.333 0 0 0 14.666 1h-12a1.333 1.333 0 0 0-1.333 1.333v1.334Z"
        />
        <path
            fill="#fff"
            d="M16 11.667A1.333 1.333 0 1 0 16 9a1.333 1.333 0 0 0 0 2.667Z"
        />
    </svg>
);

export default Wallet;
