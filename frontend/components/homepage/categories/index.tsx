import { CATEGORY, useFilter } from "@components/context/FilterContext";
import IconImg from "@ui/components/IconImg";
import { CATEGORIES } from "@utils/feed/category";
import styled, { css } from "styled-components";

export default function Categories() {
    const { category, handleChangeCategory, feed } = useFilter();

    // algolia?.spaceHits?.facets?.[filterTab]
    return (
        <Container>
            <h3>Trending Categories</h3>
            <CollectionWrapper>
                {Object.values(CATEGORIES).map(
                    // @ts-ignore
                    ({ title, key, icon, hidden }, index) => {
                        if (hidden) return null;

                        return (
                            <CollectionItem
                                key={index}
                                isActive={feed?.filter === key}
                                onClick={() => {
                                    handleChangeCategory(key as CATEGORY);
                                }}
                            >
                                {icon && (
                                    <IconImg
                                        mode={
                                            category === key ? "light" : "dark"
                                        }
                                        size={20}
                                        name={icon}
                                    />
                                )}{" "}
                                <span>{title}</span>
                            </CollectionItem>
                        );
                    }
                )}
            </CollectionWrapper>
        </Container>
    );
}

const Container = styled.div`
    h3 {
        margin: 0;
        padding-bottom: 20px;
        font-weight: 500;
    }

    margin-bottom: 24px;

    @media (max-width: 780px) {
        h3 {
            margin-bottom: 0;
        }
        padding-bottom: 24px;
        border-bottom: 1px solid rgba(7, 7, 7, 0.2);
        margin-bottom: 0;
    }
`;

const CollectionWrapper = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;

const CollectionItem = styled.div<{
    isActive: boolean;
}>`
    background: #f5f5f5;
    border-radius: 8px;
    color: #070707;

    cursor: pointer;

    padding: 12px 20px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;

    ${({ isActive }) => {
        return (
            isActive &&
            css`
                background: #070707;
                color: #f5f5f5;
            `
        );
    }}

    @media(max-width: 500px) {
        padding: 12px 16px;
        font-size: 14px;
    }
`;
