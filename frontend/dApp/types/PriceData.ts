import { PaymentToken } from "./PaymentToken";

export interface PriceDataItem {
    date: Date;
    quantity: number;
    volume: number;
}

export interface PriceData {
    items: PriceDataItem[];
    paymentToken: PaymentToken;
}
