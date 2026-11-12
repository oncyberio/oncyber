import { PaymentToken } from "./PaymentToken";
import { Marketplace } from "./Marketplace";

export interface SellOrder<O> {
    marketplace: Marketplace<any>;
    quantity: number;
    expirationDate: Date;
    currentPrice: number;
    paymentToken: PaymentToken;
    maker: {
        address: string;
        link: string;
    };
    source?: {
        name: string;
        icon?: string;
        url?: string;
    };
    orderId?: string;
    nativeOrder: O;
}

export interface BuyOrder extends SellOrder<any> {}
