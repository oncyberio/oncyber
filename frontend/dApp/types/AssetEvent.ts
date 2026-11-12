import { PaymentToken } from "./PaymentToken";

export type AssetEventType =
    | "Mint"
    | "Burn"
    | "Transfer"
    | "Offer"
    | "Listing"
    | "Sale";

export interface Account {
    address: string;
    username?: string;
    profileImg?: string;
}

export interface AssetMintEvent {
    type: "Mint";
    date: Date;
    to: Account;
    transactionHash?: string;
}

export interface AssetBurnEvent {
    type: "Burn";
    date: Date;
    from: Account;
    transactionHash?: string;
}

export interface AssetTransferEvent {
    type: "Transfer";
    date: Date;
    from: Account;
    to: Account;
    transactionHash?: string;
}

export interface AssetOfferEvent {
    type: "Offer";
    date: Date;
    from: Account;
    quantity: number;
    price: number;
    paymentToken: PaymentToken;
    orderId?: string;
}

export interface AssetListingEvent {
    type: "Listing";
    date: Date;
    from: Account;
    quantity: number;
    price: number;
    paymentToken: PaymentToken;
    orderId?: string;
}

export interface AssetSaleEvent {
    type: "Sale";
    date: Date;
    from: Account;
    to: Account;
    transactionHash?: string;
    quantity: number;
    price: number;
    paymentToken: PaymentToken;
}

export type AssetEvent =
    | AssetMintEvent
    | AssetBurnEvent
    | AssetTransferEvent
    | AssetOfferEvent
    | AssetListingEvent
    | AssetSaleEvent;
