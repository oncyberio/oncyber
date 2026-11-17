import moment from "moment";
import React, { useState } from "react";
import { Table } from "../../shared/styles";
import { tz } from "moment-timezone";
import { showError } from "@components/Dialogs";
import { Contracts } from "../../../../../shared/constants";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { tx } from "@components/context/I18nContext";

export type SetupClaimReviewTable = {
    contractName: string;
    startTime: string;
    whitelist: string;
    name: string;
    endTime: string;
    quantity: number;
    thumbnail: string;
    description?: string;
    estimateGas?: string;
    animationHash?: string;
    loadingEstGas?: boolean;
    gasPriceError?: boolean;
    maxNumberOfTokens: number;
    claimType: string;
};

export default function SetupClaimReview(props: SetupClaimReviewTable) {
    const {
        contractName,
        startTime,
        endTime,
        whitelist,
        name,
        thumbnail,
        animationHash,
        estimateGas,
        loadingEstGas,
        gasPriceError,
        description,
        claimType,
        maxNumberOfTokens,
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

    const localtz = tz.guess();

    const dateStartDate = moment.unix(parseInt(startTime)).clone().tz(localtz);

    const formatStartDate = moment(dateStartDate).format(
        "MM/DD/YYYY @ hh:mm A z"
    );

    const dateEndDate = moment.unix(parseInt(endTime)).clone().tz(localtz);

    const formatEndDate = moment(dateEndDate).format("MM/DD/YYYY @ hh:mm A z");

    const downloadCSV = useEventCallback(async () => {
        try {
            if (!whitelist) throw "empty url";
            const response = await fetch(whitelist);
            const data = await response.json();
            if (!data[0]) throw "invalid header";
            const header = Object.keys(data[0]);
            const headerString = header.join(",");
            const replacer = (key, value) => value ?? "";
            const rowItems = data.map((row) =>
                header
                    .map((fieldName) =>
                        JSON.stringify(row[fieldName], replacer)
                    )
                    .join(",")
            );

            const filename =
                decodeURI(
                    whitelist.split("/").pop().replace(".json", ".csv")
                ) || "thecsvfileuploaded.csv";

            const csv = [headerString, ...rowItems].join("\r\n");
            const downloadLink = document.createElement("a");
            const blob = new Blob(["\ufeff", csv]);
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        } catch (error) {
            console.error(error);
            showError("Failed to download file");
        }
    }, []);

    const Contract = Contracts.filter(
        (item) => item?.value === contractName
    )?.[0];

    return (
        <Table>
            <tr>
                <th>{tx("Destribution Type")}</th>
                <td>{tx("Setup a Claim Page")}</td>
            </tr>
            <tr>
                <th>{tx("Name")}</th>
                <td>{name}</td>
            </tr>
            {description && (
                <tr className="description">
                    <th>{tx("Description")}</th>
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
                <th>{tx("Cover Image")}</th>
                <td>
                    <a href={thumbnail} target={"_blank"} download>
                        {tx("Click to Download")}
                    </a>
                </td>
            </tr>
            {animationHash && (
                <tr>
                    <th>{tx("Cover Video")}</th>
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
                <th>{tx("Claim Start")}</th>
                <td>{formatStartDate}</td>
            </tr>
            <tr>
                <th>{tx("Claim End")}</th>
                <td>{formatEndDate}</td>
            </tr>
            {claimType === "allow_list" && whitelist && (
                <tr>
                    <th>{tx("List of Wallet Addresses")}</th>
                    <td className="link" onClick={downloadCSV}>
                        {tx("Click to Download")}
                    </td>
                </tr>
            )}
            <tr>
                <th>{tx("Contract for Minting")}</th>
                <td>{Contract?.title}</td>
            </tr>
            <tr>
                <th>{tx("Maximum Tokens to be Minted")}</th>
                <td>{maxNumberOfTokens}</td>
            </tr>
            <tr>
                <th>{tx("Estimated Cost to Initiate Claim")}</th>
                <td>
                    {gasPriceError
                        ? "Cannot estimate gas price"
                        : loadingEstGas
                        ? "loading…"
                        : estimateGas + " ETH"}
                </td>
            </tr>
            <tr>
                <th>{tx("Secondary Sale Royalty Take Rate")}</th>
                <td>75%</td>
            </tr>
        </Table>
    );
}
