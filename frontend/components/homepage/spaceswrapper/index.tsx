import { useFilter } from "@components/context/FilterContext";
import Spaces from "@components/Spaces";
import { CATEGORIES } from "@utils/feed/category";
import styled from "styled-components";

export default function SpacesWrapper() {
    const { category, handleChangeCategory } = useFilter();

    return (
        <div>
            <TabsWrapper>
                {/* <Tab
                    isActive={category === ""}
                    onClick={() => {
                        if (category) {
                            handleChangeCategory(category);
                        }
                    }}
                >
                    For you
                </Tab>
                <Tab
                    isActive={category === "lastModified"}
                    onClick={() => handleChangeCategory("lastModified")}
                >
                    Latest
                </Tab> */}
            </TabsWrapper>
            <Spaces />
        </div>
    );
}

const TabsWrapper = styled.div`
    display: flex;
    // gap: 32px;
    // margin-bottom: 16px;
`;

const Tab = styled.p<{
    isActive: boolean;
}>`
    margin: 0;
    cursor: pointer;
    color: #5c5c5c;

    ${({ isActive }) => isActive && "font-weight: 500; color: #000;"}
`;
