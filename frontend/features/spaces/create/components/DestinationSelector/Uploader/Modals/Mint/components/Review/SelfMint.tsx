import React, { useState } from "react";
import { Table } from "../../shared/styles";
import { Contracts } from "../../../../../shared/constants";

export type SelfMintReviewTable = {
    name: string;
    thumbnail: string;
    quantity?: number;
    description?: string;
    contractName: string;
    estimateGas?: string;
    animationHash?: string;
    loadingEstGas?: boolean;
    gasPriceError?: boolean;
    max_number_of_tokens: string;
};

export default function SelfMintReview(props: SelfMintReviewTable) {
    const {
        name,
        thumbnail,
        description,
        contractName,
        animationHash,
        estimateGas,
        loadingEstGas,
        gasPriceError,
        quantity,
    } = props || {};

    const [isEllipsis, setEllipsis] = useState(true);

    const [isCopied, setIsCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(description);
        setIsCopied(true);
        setTimeout(() => {
            setIsCopied(false);
        }, 2000);
    };

    const Contract = Contracts.filter(
        (item) => item?.value === contractName
    )?.[0];

    return (
        <Table>
            <tr>
                <th>Distribution Type</th>
                <td>Self Claim</td>
            </tr>
            <tr>
                <th>Name</th>
                <td>{name}</td>
            </tr>
            {description && (
                <tr className="description">
                    <th>Description</th>
                    <td>
                        <p>
                            {description.length <= 41 ? (
                                description
                            ) : (
                                <>
                                    {description.slice(
                                        0,
                                        isEllipsis ? 26 : description.length
                                    )}
                                    {"... "}
                                    {isEllipsis && (
                                        <a
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setEllipsis(false);
                                            }}
                                        >
                                            more
                                        </a>
                                    )}
                                </>
                            )}
                        </p>
                        {!isEllipsis && (
                            <div>
                                <span onClick={copyToClipboard}>
                                    {isCopied ? "copied" : "copy"}
                                </span>
                                <span
                                    onClick={(e) => {
                                        setEllipsis(true);
                                    }}
                                >
                                    less
                                </span>
                            </div>
                        )}
                    </td>
                </tr>
            )}
            <tr>
                <th>Cover Image</th>
                <td>
                    <a href={thumbnail} target={"_blank"} download>
                        Click to Download
                    </a>
                </td>
            </tr>
            {animationHash && (
                <tr>
                    <th>Cover Video</th>
                    <td>
                        <a
                            href={`https://cyber.mypinata.cloud/ipfs/${animationHash}`}
                            target={"_blank"}
                            download
                        >
                            Click to Download
                        </a>
                    </td>
                </tr>
            )}
            <tr>
                <th>Contract for Minting</th>
                <td>{Contract?.title}</td>
            </tr>
            <tr>
                <th>Tokens to be minted</th>
                <td>{quantity}</td>
            </tr>
            <tr>
                <th>Estimated Cost to Initiate Claim</th>
                <td>
                    {gasPriceError
                        ? "Cannot estimate gas price"
                        : loadingEstGas
                        ? "loading…"
                        : estimateGas + " ETH"}
                </td>
            </tr>
            <tr>
                <th>Secondary Sale Royalty Take Rate</th>
                <td>75%</td>
            </tr>
        </Table>
    );
}
