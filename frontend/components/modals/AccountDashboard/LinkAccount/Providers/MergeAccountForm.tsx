import {
    ButtonsWrapper,
    Container,
    Error,
    MetadataWrapper,
    MetadatasWrapper,
    UserWrapper,
    UsersWrapper,
} from "./styles";

import Avatar from "@ui/components/Avatar";

import RadioBox from "@ui/components/RadioBox";

import { NButton } from "@ui/components/NButton";
import { baseTokens as base } from "@styles/tokens";

import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/factory/player/constants";

import IconImg from "@ui/components/IconImg";

export default function MergeAccountForm({
    userData,
    mergeAccount,
    setMergeAccount,
    handleMerge,
    selectedAccountToMerge,
    setSelectedAccountToMerge,
    merging,
    setError,
    mergeError,
}) {
    function handleCancel() {
        setMergeAccount(null);

        setError("");
    }

    return (
        <Container>
            {mergeError ? (
                mergeError === "LIMIT_EXCEEDED" ? (
                    <div
                        style={{
                            marginBottom: 24,
                            color: "var(--danger-color)",
                        }}
                    >
                        <p>
                            Hey! Your account is on the larger side and cannot
                            be merged at this time. Please open a support ticket
                            in our discord for additional help:{" "}
                            <a
                                href="https://discord.gg/3dEQXmAXnv"
                                target="_blank"
                                style={{ fontWeight: 600 }}
                            >
                                https://discord.gg/3dEQXmAXnv
                            </a>
                        </p>
                    </div>
                ) : (
                    <Error>{mergeError} </Error>
                )
            ) : (
                <Error
                    style={{ marginBottom: 24, color: "var(--content-color)" }}
                >
                    We found another oncyber profile on the account you're
                    trying to link. Linking this wallet to your profile will
                    move the spaces, assets and avatars created on that account
                    to your currently logged in profile.
                </Error>
            )}

            <div>
                <p style={{ marginBottom: 12 }}>
                    Which username would you like to keep?
                </p>
                <UsersWrapper>
                    <UserWrapper
                        onClick={() => {
                            if (merging) return;

                            setSelectedAccountToMerge("current");
                        }}
                        isActive={selectedAccountToMerge === "current"}
                    >
                        <div className="userwrapper_avatar_wrapper">
                            <Avatar
                                size="small"
                                src={
                                    userData.avatar ||
                                    DEFAULT_PLAYER_AVATAR_PICTURE
                                }
                            />
                            <div>
                                <p className="userwrapper_username">
                                    @{userData.username || userData.walletId}
                                </p>
                                <p>current</p>
                            </div>
                        </div>

                        <RadioBox
                            selectedColor={base.color.ink}
                            onClick={() => {
                                if (merging) return;

                                setSelectedAccountToMerge("current");
                            }}
                            selected={selectedAccountToMerge === "current"}
                            item={{ title: "", value: "current" }}
                        />
                    </UserWrapper>
                    <UserWrapper
                        onClick={() => {
                            if (merging) return;

                            setSelectedAccountToMerge("target");
                        }}
                        isActive={selectedAccountToMerge === "target"}
                    >
                        <div className="userwrapper_avatar_wrapper">
                            <Avatar
                                size="small"
                                src={
                                    mergeAccount.avatar ||
                                    DEFAULT_PLAYER_AVATAR_PICTURE
                                }
                            />
                            <div>
                                <p className="userwrapper_username">
                                    @
                                    {mergeAccount.username ||
                                        mergeAccount.walletId}
                                </p>
                                <p>merge account</p>
                            </div>
                        </div>

                        <RadioBox
                            selectedColor={base.color.ink}
                            onClick={() => {
                                if (merging) return;

                                setSelectedAccountToMerge("target");
                            }}
                            selected={selectedAccountToMerge === "target"}
                            item={{
                                title: "",
                                value: "target",
                            }}
                        />
                    </UserWrapper>
                </UsersWrapper>
            </div>

            <p style={{ marginBottom: 12 }}>
                The following will be merged to your current account:
            </p>

            <MetadatasWrapper>
                {mergeAccount.exhibitIds ? (
                    <MetadataWrapper>
                        <IconImg mode="light" name="activity" size={12} />
                        {mergeAccount.exhibitIds === 1 ? (
                            <p>{`${mergeAccount.exhibitIds} Space`}</p>
                        ) : (
                            <p>{`${mergeAccount.exhibitIds} Spaces`}</p>
                        )}
                    </MetadataWrapper>
                ) : null}
                {mergeAccount.linkedAccounts ? (
                    <MetadataWrapper>
                        <IconImg mode="light" name="activity" size={12} />
                        {mergeAccount.linkedAccounts === 1 ? (
                            <p>{`${mergeAccount.linkedAccounts} Linked Account`}</p>
                        ) : (
                            <p>{`${mergeAccount.linkedAccounts} Linked Accounts`}</p>
                        )}
                    </MetadataWrapper>
                ) : null}
                {mergeAccount.uploadedAssets ? (
                    <MetadataWrapper>
                        <IconImg mode="light" name="activity" size={12} />
                        {mergeAccount.uploadedAssets === 1 ? (
                            <p>{`${mergeAccount.uploadedAssets} Uploaded Asset`}</p>
                        ) : (
                            <p>{`${mergeAccount.uploadedAssets} Uploaded Assets`}</p>
                        )}
                    </MetadataWrapper>
                ) : null}
                {mergeAccount.destinations ? (
                    <MetadataWrapper>
                        <IconImg mode="light" name="activity" size={12} />
                        {mergeAccount.destinations === 1 ? (
                            <p>{`${mergeAccount.destinations} Destination`}</p>
                        ) : (
                            <p>{`${mergeAccount.destinations} Destinations`}</p>
                        )}
                    </MetadataWrapper>
                ) : null}
                {mergeAccount.favorites ? (
                    <MetadataWrapper>
                        <IconImg mode="light" name="activity" size={12} />
                        {mergeAccount.favorites === 1 ? (
                            <p>{`${mergeAccount.favorites} Bookmark`}</p>
                        ) : (
                            <p>{`${mergeAccount.favorites} Bookmarks`}</p>
                        )}
                    </MetadataWrapper>
                ) : null}
            </MetadatasWrapper>

            <ButtonsWrapper>
                <NButton
                    onClick={() => handleCancel()}
                    outline
                    overrideTheme="dark"
                    size="small"
                >
                    Cancel
                </NButton>
                <NButton
                    overrideTheme="dark"
                    disabled={merging}
                    onClick={() => handleMerge(selectedAccountToMerge)}
                    size="small"
                >
                    {merging ? "Merging…" : "Merge account"}
                </NButton>
            </ButtonsWrapper>
        </Container>
    );
}
