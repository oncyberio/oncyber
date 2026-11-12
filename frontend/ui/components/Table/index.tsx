import React from "react";
import styled from "styled-components";

interface TableProps {
    columns: Array<{
        [key: string]: any;
    }>;
    rows: Array<{
        [key: string]: any;
    }>;
    className?: string;
    style?: React.CSSProperties;
}

export default function Table({
    columns,
    rows,
    className = "",
    style = {},
}: TableProps) {
    return (
        <TableWrapper className={className} style={style}>
            <Container>
                <thead>
                    <Header>
                        {columns.map((column, index) => {
                            const { headerName, width, maxWidth, textAlign } =
                                column;

                            return (
                                <th
                                    style={{
                                        ...(width && {
                                            width,
                                            minWidth: width,
                                            maxWidth: maxWidth || "auto",
                                        }),
                                        ...(textAlign && { textAlign }),
                                    }}
                                    key={index}
                                >
                                    {headerName}
                                </th>
                            );
                        })}
                    </Header>
                </thead>

                <tbody className="t-body">
                    {rows.map((row, index) => {
                        //
                        return (
                            <Tr key={row._id || index}>
                                {Object.keys(row).map((rowKey, index) => {
                                    //

                                    if (rowKey === "_id") return null;

                                    const Component = row[rowKey];

                                    const column = columns.find(
                                        (column) => column.field === rowKey
                                    );

                                    return (
                                        <td
                                            key={index}
                                            onClick={column?.onClick}
                                            style={{
                                                ...(column?.width && {
                                                    width: column?.width,
                                                    minWidth: column?.width,
                                                    maxWidth:
                                                        column?.maxWidth ||
                                                        "auto",
                                                }),
                                                ...(column?.textAlign && {
                                                    textAlign:
                                                        column?.textAlign,
                                                }),
                                                ...(column?.onClick
                                                    ? { pointer: "cursor" }
                                                    : { pointer: "default" }),
                                            }}
                                        >
                                            {typeof row[rowKey] ===
                                            "function" ? (
                                                <Component />
                                            ) : (
                                                row[rowKey]
                                            )}
                                        </td>
                                    );
                                })}
                            </Tr>
                        );
                    })}
                </tbody>
            </Container>
        </TableWrapper>
    );
}

const Tr = styled.tr``;

const TableWrapper = styled.div`
    width: 100%;
    overflow-x: auto;
    font-size: 14px;
`;

const Header = styled.tr`
    background: #f5f5f5;

    text-align: left;
`;

const Container = styled.table`
    border-collapse: collapse;
    width: 100%;

    font-style: normal;
    font-size: 14px;
    line-height: 24px;

    border-collapse: collapse;

    overflow-x: auto;

    tr {
        padding: 4px 0;
    }

    th:first-child {
        border-top-left-radius: 8px;
        border-bottom-left-radius: 8px;
    }

    th:last-child {
        border-top-right-radius: 8px;
        border-bottom-right-radius: 8px;
    }

    td,
    th {
        padding: 8px 12px;
        font-weight: 400;
        color: #292929;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        max-width: 300px;
    }

    th {
        line-height: 24px;
        color: #5d5f65;
        background: #f5f5f5;
        white-space: nowrap;
    }

    td {
        padding: 8px 12px;
        font-weight: 400;
    }
`;
