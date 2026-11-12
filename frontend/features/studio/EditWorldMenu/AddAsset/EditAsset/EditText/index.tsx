import styled from "styled-components";
import { TextInput } from "./TextInput";
import { ArtworkSize } from "../EditArtwork/ArtworkSize";
import { TextStyle } from "./TextStyle";

import { TextHeight } from "./TextHeight";
import { ArtworkCoordinates } from "../EditArtwork/ArtworkCoordinates";
import { TextColor } from "./TextColor";
import { TextWidth } from "./TextWidth";
import { TextFont } from "./TextFont";

export function EditText() {
    return (
        <Container>
            <div className="section">
                <TextInput />
                <TextFont />
                <TextStyle />
                <TextColor />
            </div>
            <div className="section">
                <TextHeight />
                <TextWidth />
            </div>
            <div className="section">
                <ArtworkSize />
                <ArtworkCoordinates isYOnly={false} />
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;

    & > .section {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    & > .section + .section {
        padding-top: 16px;
        border-top: 1px solid var(--studio-line);
    }
`;
