import styled from "styled-components";

export function Sep() {
    return (
        <Container
        // width="13"
        // height="30"
        // viewBox="0 0 13 30"
        // fill="none"
        // xmlns="http://www.w3.org/2000/svg"
        >
            {/* <path d="M1 -5.24546e-07L1 21C1 25.4183 4.58172 29 9 29L13 29" /> */}
        </Container>
    );
}

const Container = styled.div`
    position: absolute;
    left: 0;
    top: 0;
    height: 60%;
    width: 12px;
    border-left: 1px solid;
    border-bottom: 1px solid;
    margin-left: -1px;
    border-bottom-left-radius: 20px;
    border-color: var(--timeline-border-color);
`;
