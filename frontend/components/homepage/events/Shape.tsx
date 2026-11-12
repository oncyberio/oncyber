import React from "react";

type ShapeType = {
    id: string;
    xlinkHref: string;
    size: "small" | "large";
};

export default function Shape({ id, xlinkHref, size }: ShapeType) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 310 185"
        >
            <defs>
                <clipPath id={id}>
                    <path
                        fill="#F5F5F5"
                        d={
                            size == "large"
                                ? "M0 32C0 27.5817 3.58172 24 8 24H91.5C98.5 24 99 16 99 16V8C99 3.58172 102.582 0 107 0H302C306.418 0 310 3.58172 310 8V208V272V302C310 306.418 306.418 310 302 310H7.99999C3.58171 310 0 306.418 0 302V272V208V32Z"
                                : "M8 24a8 8 0 00-8 8v270a8 8 0 008 8h294a8 8 0 008-8V8a8 8 0 00-8-8H71a8 8 0 00-8 8v8a8 8 0 01-8 8H8z"
                        }
                    ></path>
                </clipPath>
            </defs>
            <image
                width="100%"
                height="100%"
                clipPath={`url(#${id})`}
                preserveAspectRatio="xMidYMid slice"
                xlinkHref={xlinkHref}
            ></image>
        </svg>
    );
}
