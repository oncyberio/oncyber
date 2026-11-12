import { Asset } from "@uitypes/Asset";

export type ExhibitRole =
    | "owner"
    | "co-curator"
    | "admin-curator"
    | "delegator";

export interface UserExhibit {
    id: string;
    invited?: boolean;
    isAdminCurator?: boolean;
    isCurator?: boolean;
    privilege?: ExhibitRole;
}

export interface LinkedAccount {
    providerId: string;
    type: "web2" | "web3";
    accountId: string;
    photoURL?: string;
    displayName?: string;
    email?: string;
    chainType?: string;
    originalWalletId?: string;
    twitterHandle?: string;
}

export interface User {
    currentExhibitId: string;
    description?: string;
    username?: string;
    walletId: string;
    banner?: string;
    socials?: {
        rarible?: {
            enabled: boolean;
            url: string;
        };
        foundation?: {
            enabled: boolean;
            url: string;
        };
        superrare?: {
            enabled: boolean;
            url: string;
        };
        twitter?: {
            handle: string;
            active: boolean;
        };
    };
    vrm?: string;
    avatar?: string;
    avatarVerified?: boolean;
    id: string;
    walletCustomName: string;
    exhibitIds?: Array<UserExhibit>;
    assets: any;
    settings?: any;
    avatarContractAddress: string;
    avatarTokenId: string;
    visitedSpaces: string[];
    type: "web2" | "web3";
    providerId: string;
    linkedAccounts: Array<LinkedAccount>;
}

export interface UserState extends User {}
