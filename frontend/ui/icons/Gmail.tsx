import React from "react";

function Gmail(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="18"
            fill="none"
            viewBox="0 0 24 18"
            {...props}
        >
            <g clipPath="url(#clip0_7332_4453)">
                <path
                    fill="#4285F4"
                    d="M1.636 18h3.819V8.727L0 4.637v11.727C0 17.269.734 18 1.636 18z"
                ></path>
                <path
                    fill="#34A853"
                    d="M18.545 18h3.819c.905 0 1.636-.734 1.636-1.636V4.636l-5.455 4.091"
                ></path>
                <path
                    fill="#FBBC04"
                    d="M18.545 1.636v7.091L24 4.637V2.454C24 .43 21.69-.723 20.073.49"
                ></path>
                <path
                    fill="#EA4335"
                    d="M5.455 8.727v-7.09L12 6.544l6.546-4.909v7.091L12 13.637"
                ></path>
                <path
                    fill="#C5221F"
                    d="M0 2.455v2.181l5.455 4.091v-7.09L3.927.49C2.307-.723 0 .43 0 2.455z"
                ></path>
            </g>
            <defs>
                <clipPath id="clip0_7332_4453">
                    <path fill="#fff" d="M0 0H24V18H0z"></path>
                </clipPath>
            </defs>
        </svg>
    );
}

export default Gmail;
