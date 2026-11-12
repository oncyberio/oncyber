import styled from "styled-components";
import ChevronDown from "./Icons/ChevronDown";

export default function Search() {
    return (
        <SelectContainer>
            <Input
                type="text"
                placeholder="Search by headline, wallet address…"
            />
            <div>
                <Select>
                    <option label="Worlds" value="exp" />
                    <option label="Creators" value="profiles" />
                </Select>
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        transform: "translateY(-50%)",
                        right: 10,
                    }}
                >
                    <ChevronDown size={24} />
                </div>
            </div>
        </SelectContainer>
    );
}

const SelectContainer = styled.div`
    position: relative;
    width: 100%;
    display: grid;
    grid-template-columns: 10fr 2fr;
    margin: 24px 0 8px 0;

    // input

    @media (max-width: 1100px) {
        grid-template-columns: 9fr 3fr;
    }

    @media (max-width: 700px) {
        grid-template-columns: 3fr 1fr;
    }

    @media (max-width: 600px) {
        grid-template-columns: 8fr 4fr;
    }

    :focus {
        outline: none;
        background: #f1f3f4;
        border-right-width: 0;
    }
`;

const Input = styled.input`
    background: #f9f9f9;
    border: 2px solid #dadce0;
    border-right-width: 0;
    width: 100%;
    appearance: none;
    border-radius: 9999px 0 0 9999px;
    padding: 16px 32px;
    font-size: 1rem;

    transition: 0.2s;

    :focus {
        outline: none;
        background: #f1f3f4;
        border-right-width: 0;
    }
`;

const Select = styled.select`
    background: #fff;
    border: 2px solid #dadce0;
    width: 100%;
    appearance: none;
    border-radius: 0 9999px 9999px 0;
    padding: 16px;
    font-size: 1rem;
    transition: 0.2s;

    :focus {
        outline: none;
    }
`;
