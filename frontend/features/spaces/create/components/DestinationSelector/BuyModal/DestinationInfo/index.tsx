import styled from "styled-components";
import { useAuthorName } from "../../useAuthorName";
import { DestinationActivity } from "../DestinationActivity";
import { DestinationMarketplace } from "../DestinationMarketplace";
import { useCurrentRoom } from "../RoomContext";

export interface DestinationInfoProps {}

export function DestinationInfo() {
    const room = useCurrentRoom();

    const {
        image,
        thumbnail,
        name,
        description,
        author,
        capacity,
        editions,
        nonFungible,
    } = room;

    const authorName = useAuthorName(author);

    return (
        <Container>
            <h2 className="title">{name}</h2>
            <div className="author">
                <span style={{ opacity: 0.6 }}>Space by </span>
                {authorName}
            </div>
            <div className="desc">{description}</div>
            <DestinationMarketplace />
            <div className="sep" />
            <DestinationActivity />
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;

    & > .sep {
        border-bottom: 1px solid var(--border-color);
        margin-top: 16px;
        margin-bottom: 16px;
    }

    & .title {
        margin: 0;

        font-weight: 400;
        font-size: 24px;
        line-height: 26px;
        color: var(--title-color);
        margin-bottom: 12px;
    }

    & .author {
        font-family: "Aeonik";
        font-style: normal;
        font-weight: 400;
        font-size: 13px;
        line-height: 20px;
    }

    & .desc {
        margin-top: 12px;
        margin-bottom: 20px;
        flex: 1;
        max-height: 100px;
        overflow-y: auto;
        font-weight: 400;
        font-size: 14px;
        line-height: 24px;
        color: var(--content-color);
    }
`;
