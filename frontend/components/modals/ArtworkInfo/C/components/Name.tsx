import React from "react";
import styled from "styled-components";
import { User } from "../../../../../@types/user";

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
