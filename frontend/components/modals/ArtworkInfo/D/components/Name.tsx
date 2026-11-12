import React from "react";

export interface Name {
    name: string;
    url: string;
    style?: object;
}

export const Name = ({ name, url, style = {} }: Name) => {
    return (
        <a
            target="_blank"
            className="truncated name"
            style={style}
            href={url}
            rel="noopener noreferrer"
        >
            {name}
        </a>
    );
};
