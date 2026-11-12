import styled from "styled-components";
import { studioField } from "./primitives";

export const TextInput = styled.input`
    ${studioField}
`;
export const TextArea = styled.textarea`
    ${studioField}
    margin: 0;
    resize: none;
    height: 80px;
`;
