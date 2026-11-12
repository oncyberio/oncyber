import { studioField, studioHeading } from "@features/studio/styles/primitives";
import { useCyberTranslation } from "@components/context/I18nContext";
import InviteCancel from "@components/modals/InviteCancel";
import { UserContext } from "@context/UserContext";
import InlineError from "@ui/components/InlineError";
import Table from "@ui/components/Table";
import { canChangeRole, UserRole } from "@utils/invite";
import { removeKey } from "@utils/js";

import {
    changePrivilege,
    getEditorsProfile,
    getExhibitEditors,
} from "@utils/saveToDb";

import { useContext, useEffect, useMemo, useState } from "react";

import styled from "styled-components";
import useSWR from "swr";
import { useStudioMenu } from "../../context/StudioContext";
import Invite from "./Invite";
import { fetchEditors } from "./utils";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

interface Item {
    title: string;
    value: UserRole | "";
    disabled?: boolean;
}

const privileges: Array<Item> = [
    {
        title: "Change privilege",
        value: "",
        disabled: true,
    },
    {
        title: "Owner",
        value: "owner",
        disabled: true,
    },
    {
        title: "Admin curator",
        value: "admin-curator",
    },
    {
        title: "Co curator",
        value: "co-curator",
    },
    {
        title: "Delegator",
        value: "delegator",
    },
];

export function getPrivilegeTitle(privilege) {
    let privilegeTitle = "";

    if (privilege === "owner") {
        privilegeTitle = "OWNER";
    } else if (privilege === "co-curator") {
        privilegeTitle = "CO_CURATOR";
    } else if (privilege === "admin-curator") {
        privilegeTitle = "ADMIN_CURATOR";
    } else if (privilege === "delegator") {
        privilegeTitle = "DELEGATOR";
    }

    return privilegeTitle;
}

export default function Collab() {
    //
    const [isActive, setActive] = useState("collaborators");

    const { user } = useContext(UserContext);

    const { exhibit, userRole, baseAnalyticsEvent } = useStudioMenu();

    const { t } = useCyberTranslation();

    const [cancelWalletId, setCancelWalletId] = useState<string>();

    const [showInviteCancel, setShowInviteCancel] = useState(false);

    const [privilegeChangeLoading, setPrivilegeChangeLoading] = useState<
        Record<string, boolean>
    >({});

    // The role change that failed, shown under the table with a Retry that
    // asks for the same role again (docs/feedback.md).
    const [failedChange, setFailedChange] = useState<{
        index: number;
        privilege: string;
        name: string;
    }>(null);

    const {
        data: editors,
        error,
        isLoading,
        mutate,
    } = useSWR(`exhibit_collabs/${exhibit.id}`, () => fetchEditors(exhibit));

    const role: UserRole =
        editors?.find((it) => {
            //
            return it.walletId?.toLowerCase() === user.id.toLowerCase();
        })?.privilege || userRole;

    useEffect(() => {
        amplitude_logAnalyticsEvent("open_collaborators", baseAnalyticsEvent);
    }, []);

    useEffect(() => {
        //

        if (role === "owner") {
            //
            mutate();
        }
        //
    }, [exhibit.editors, role]);

    async function handleChangePrivilege(e, index) {
        //
        await changePrivilegeTo(e.target.value, index);
    }

    async function changePrivilegeTo(privilege: string, index: number) {
        //
        const editor = editors[index];

        const name = editor.username
            ? `@${editor.username}`
            : `${editor.walletId?.slice?.(0, 5)}...`;

        setFailedChange(null);

        try {
            setPrivilegeChangeLoading((state) => ({
                ...state,
                [editor.walletId]: true,
            }));

            const data = await changePrivilege({
                editorId: editor.walletId,
                exhibitId: exhibit.id,
                privilege,
            });

            if (!data.success) throw new Error(data.message || data.error);

            if (data.success) {
                //
                mutate(
                    //
                    editors.map((_editor) => {
                        if (_editor.walletId === editor.walletId) {
                            //
                            return {
                                ..._editor,
                                privilege: data.privilege,
                            };
                        }

                        return _editor;
                    })
                );
            }
        } catch (err) {
            //
            console.error(err);

            setFailedChange({ index, privilege, name });
            //
        } finally {
            //
            setPrivilegeChangeLoading((state) =>
                removeKey(editor.walletId, state)
            );
        }
    }

    const data = useMemo(() => {
        //
        if (isLoading || error) return null;

        return editors.map((editor, index) => {
            //
            const { username, avatar, walletId, privilege } = editor || {};

            const sameUser = user.id.toLowerCase() === walletId.toLowerCase();

            const canChange = canChangeRole(role, privilege);

            const formattedWalletId = `${walletId?.slice?.(
                0,
                5
            )}...${walletId?.slice?.(walletId.length - 5, walletId.length)}`;

            let privilegeTitle = getPrivilegeTitle(privilege);

            return {
                name: (
                    <Collaborator>
                        <img src={avatar || "/images/opensea-black.png"} />
                        <div>
                            <p className="collab-username">
                                {username
                                    ? `@${username}`
                                    : `@${formattedWalletId}`}
                            </p>
                            <span className="collab-wallet">
                                {formattedWalletId}
                            </span>
                        </div>
                    </Collaborator>
                ),
                responsibility: (
                    <div>
                        {!privilegeChangeLoading[walletId] ? (
                            privilege === "owner" || !canChange ? (
                                <span>{t(privilegeTitle)}</span>
                            ) : (
                                <Select
                                    onChange={async (e) => {
                                        handleChangePrivilege(e, index);
                                    }}
                                    value={privilege}
                                >
                                    {privileges.map((_privilege) => {
                                        return (
                                            <option
                                                disabled={
                                                    _privilege.disabled ||
                                                    _privilege.value === "" ||
                                                    !canChangeRole(
                                                        role,
                                                        _privilege.value
                                                    )
                                                }
                                                value={_privilege.value}
                                            >
                                                {_privilege.title}
                                            </option>
                                        );
                                    })}
                                </Select>
                            )
                        ) : (
                            <p>Loading...</p>
                        )}
                    </div>
                ),
                remove:
                    walletId === exhibit.owner ? (
                        <div className="collab-label">(owner)</div>
                    ) : sameUser || !canChange ? (
                        ""
                    ) : (
                        <div
                            onClick={() => {
                                if (user.id == walletId) return;
                                if (walletId === exhibit.owner) return;
                                setCancelWalletId(walletId);
                                setShowInviteCancel(true);
                            }}
                            className="table-action"
                        >
                            Remove
                        </div>
                    ),
            };
        });
    }, [editors, user.id, privilegeChangeLoading]);

    return (
        <Container>
            <InviteCancel
                walletId={cancelWalletId}
                toggle={() => setShowInviteCancel((prevState) => !prevState)}
                isShowing={showInviteCancel}
            />

            <h2>Edit collaborators</h2>

            {isLoading && (
                <p className="loading" role="status">
                    Loading collaborators…
                </p>
            )}

            {data && (
                <TableWrapper>
                    {isActive === "collaborators" ? (
                        <Table
                            rows={data}
                            columns={[
                                {
                                    field: "name",
                                    headerName: "Name",
                                    width: 160,
                                },
                                {
                                    field: "responsibility",
                                    headerName: "Responsibility",
                                    width: 160,
                                },
                                {
                                    field: "remove",
                                    type: "action",
                                    headerName: "Action",
                                },
                            ]}
                        />
                    ) : null}
                </TableWrapper>
            )}

            <InlineError
                message={
                    failedChange &&
                    !privilegeChangeLoading[
                        editors?.[failedChange.index]?.walletId
                    ] &&
                    `Couldn't change ${failedChange.name}'s role.`
                }
                onRetry={() =>
                    changePrivilegeTo(
                        failedChange.privilege,
                        failedChange.index
                    )
                }
            />

            <Invite />
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: min(475px, calc(100vw - 64px));
    max-height: 500px;
    overflow: auto;
    border-radius: var(--studio-radius-control);
    color: var(--studio-ink);

    & > h2 {
        ${studioHeading}
    }

    & > .loading {
        margin: 0;
        font: 400 13px/20px var(--studio-font, sans-serif);
        color: var(--studio-muted);
    }
`;

const Collaborator = styled.div`
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 8px 0px;
    border-radius: var(--studio-radius-control);
    transition: 0.3s;

    &:hover {
        background: var(--studio-hover);
    }

    & > div {
        margin-left: 6px;
        display: flex;
        flex-direction: column;
        align-items: start;
        justify-content: space-between;
        background: transparent;

        p,
        span {
            font-size: 12px;
            margin: 0px 0;
        }

        p {
            font-size: 13px;
            max-height: 40px;
            max-width: 14ch;
            color: var(--studio-ink);
            overflow: hidden;
            font-weight: 500;
            text-align: left;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        span {
            font-size: 11px;
            line-height: 18px;
            opacity: 0.8;
        }
    }

    img {
        width: 32px;
        height: 32px;
        border-radius: 100px;
        object-fit: cover;
    }

    @media (max-width: 600px) {
        img {
            width: 25px;
            height: 25px;
        }
    }

    @media (max-width: 800px) {
        padding: 8px 4px;

        & > div {
            display: flex;
            flex-direction: column;
            align-items: start;
            justify-content: space-between;

            p {
                font-size: 12px;
                max-height: 16px;
            }

            span {
                font-size: 11px;
            }
        }
    }
`;

const Select = styled.select`
    ${studioField}
    border-radius: var(--studio-radius-control);
    padding: 8px;
    font-size: 13px;
    background: var(--studio-surface);
    color: #ffffff;
    border-radius: var(--studio-radius-control);
    border: none;
    outline: none;

    & > option {
        margin: 1em 0;
        padding: 8px 0;
    }
`;

const TableWrapper = styled.div`
    & thead th {
        color: var(--studio-muted, #a1a1a8);
    }
    flex: 1 1 0;
    overflow-y: 0;

    & .collab-username {
        font-weight: 500;
        font-size: 13px;
        line-height: 24px;
        color: #ffffff;
        line-height: 120%;
    }

    & .collab-wallet {
        font-weight: 400;
        font-size: 12px;
        line-height: 100%;
        color: var(--studio-muted);
    }

    & .collab-label {
        font-weight: 500;
        font-size: 13px;
        line-height: 24px;
        color: var(--studio-muted);
    }

    & thead,
    & thead > tr,
    & thead > tr > th {
        background: var(--studio-surface);
    }

    & .t-body {
        max-height: 400px;
        overflow-y: auto;

        & > tr {
            border-bottom: 1px solid var(--studio-line);
        }

        th {
            text-transform: uppercase;
            color: var(--studio-muted);
        }

        td {
            color: #ffffff;
            font-weight: 500;
            font-size: 13px;
            line-height: 24px;
        }

        & .table-action {
            border: none;
            background: none;
            font-weight: 500;
            font-size: 13px;
            line-height: 24px;
            color: #ffffff;
            cursor: pointer;
        }
    }
`;
