// Only contracts referenced below are imported: every JSON imported here
// ships to the browser with any page that reads this config. The unused
// Goerli and localhost curated contracts were dropped from the bundle (the
// files are still in config/).

// Localhost Factory contract
import localhostFactoryContract from "./localhost/DiamondCyberDestinationUtilityFactory.json";

// ETH Curated contract
import mainCuratedContract from "./ethereum/DiamondCyberDestinationFactory.json";
import rinkebyCuratedContract from "./rinkeby/DiamondCyberDestinationFactory.json";

// ETH Factory contract
import mainFactoryContract from "./ethereum/DiamondCyberDestinationUtilityFactory.json";
import rinkebyFactoryContract from "./rinkeby/DiamondCyberDestinationUtilityFactory.json";

// ETH Factory contract
import onCyberandFriendsContract from "./ethereum/DiamondOnCyberAndFriendsFactory.json";
import rinkebyOnCyberAndFriendsContract from "./rinkeby/DiamondOnCyberAndFriendsFactory.json";

// Polygon Factory contract
import polygonFactoryContract from "./polygon/DiamondCyberDestinationUtilityFactory.json";
// import rinkebyFactoryContract from "./rinkeby/DiamondCyberDestinationUtilityFactory.json";

import oncyberEtherDiamondOnCyberCommunityFactory from "./oncyber-ethereum-community/DiamondOnCyberCommunityFactory.json";

import rtfktRaffleContract from "./rtfkt/raffle.json";

// RTFKT ETH Contract
import rtfktPodsContract from "./rtfkt/abi.json";
import exoPodsContract from "./rtfkt/abi2.json";

import manifoldContract from "./manifold/manifold.json";

import { nodeEnv } from "@env";

const config = {
    "oncyber-ethereum-community": {
        mainnetAddress: "0x449f661c53aE0611a24c2883a910A563A7e42489",
        json: oncyberEtherDiamondOnCyberCommunityFactory,
        minterNonceMax: parseInt(process.env.FACTORY_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat("0.25"), // 30%
        rpc: nodeEnv.ETH_RPC,
        manager: process.env.COMMUNITY_MANAGER_PRIVATE_KEY,
        network: "ethereum",
        chainID: 1,
    },
    "factory-polygon": {
        mainnetAddress: "0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0",
        json: polygonFactoryContract,
        minterNonceMax: parseInt(process.env.FACTORY_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat("0.25"),
        rpc: nodeEnv.POLYGON_RPC,
        manager: process.env.POLYGON_MANAGER_PRIVATE_KEY,
        network: "polygon",
        chainID: 137,
    },
    // duplicate from factory-polygon
    "oncyber-polygon-community": {
        mainnetAddress: "0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0",
        json: polygonFactoryContract,
        minterNonceMax: parseInt(process.env.FACTORY_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat("0.25"),
        rpc: nodeEnv.POLYGON_RPC,
        manager: process.env.POLYGON_MANAGER_PRIVATE_KEY,
        network: "polygon",
        chainID: 137,
    },
    manifold: {
        json: manifoldContract,
        network: "ethereum",
        chainID: 1,
    },
    rtfktRaffle: {
        mainnetAddress:
            process.env.RTFKT_RAFFLE_CONTRACT ||
            "0x253ef258563E146f685e60219DA56a6b75178E19",
        json: rtfktRaffleContract,
        network: "ethereum",
        chainID: 1,
    },
    localhost: {
        mainnetAddress:
            process.env.FACTORY_CONTRACT_ADDRESS ||
            "0xDeFB45F660166B3FE43Ec110AcaFEBcFC5185b33",
        json: localhostFactoryContract,
        minterNonceMax: parseInt(process.env.FACTORY_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat("0.25"), // 30%
        rpc: process.env.NEXT_PUBLIC_ETH_RPC || "http://127.0.0.1:8545",
        manager: process.env.FACTORY_MANAGER_PRIVATE_KEY,
        network: "localhost",
        chainID: 31337,
    },
    andfriends: {
        mainnetAddress:
            process.env.NODE_ENV == "production"
                ? "0xA642375Cc15249A81da9c435fB4eDD8A9343ce7F"
                : "0x6ED0189BD3BA56a88A0b27ED4437e7c7a95B53F6",
        json:
            process.env.NODE_ENV == "production"
                ? onCyberandFriendsContract
                : rinkebyOnCyberAndFriendsContract,
        minterNonceMax: parseInt(process.env.FACTORY_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat("0.5"),
        manager: process.env.ANDFRIENDS_MANAGER,
        rpc:
            process.env.NODE_ENV == "production"
                ? nodeEnv.ETH_RPC
                : nodeEnv.ETH_RPC,
        network: "ethereum",
        chainID: 1,
    },
    env:
        process.env.NEXT_PUBLIC_NODE_ENV ||
        process.env.NODE_ENV ||
        "development",
    supportedContracts: process.env.SUPPORTED_CONTRACTS
        ? process.env.SUPPORTED_CONTRACTS.split(",")
        : ["curated", "factory"],
    curated: {
        manager: process.env.FACTORY_MANAGER_PRIVATE_KEY,
        mainnetAddress: "0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3",
        json:
            process.env.NODE_ENV == "production"
                ? mainCuratedContract
                : rinkebyCuratedContract,
        allowedMinter: process.env.CURATED_ALLOWED_MINTER_ADDRESS
            ? process.env.CURATED_ALLOWED_MINTER_ADDRESS.split(",")
            : [
                  "0xBeb171bA24e66014F356Bca0DB05329EFea14964",
                  "0x76DB02500F7631d57BC2DcDCa9d4cf782b99E119",
              ],
        minterNonceMax: parseInt(process.env.CURATED_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat(
            process.env.NEXT_PUBLIC_MIN_ONCYBER_SHARES || "0.3"
        ), // 30%
        rpc:
            nodeEnv.ETH_RPC ,
        network: "ethereum",
        chainID: 1,
    },
    factory: {
        mainnetAddress:
            process.env.NODE_ENV == "production"
                ? "0x226Bf5293692610692E2C996C9875C914d2A7f73"
                : "0xDeFB45F660166B3FE43Ec110AcaFEBcFC5185b33",
        json:
            process.env.NODE_ENV == "production"
                ? mainFactoryContract
                : rinkebyFactoryContract,
        allowedMinter: process.env.FACTORY_ALLOWED_MINTER_ADDRESS
            ? process.env.FACTORY_ALLOWED_MINTER_ADDRESS.split(",")
            : [
                  "0xBeb171bA24e66014F356Bca0DB05329EFea14964",
                  "0x76DB02500F7631d57BC2DcDCa9d4cf782b99E119",
              ],
        minterNonceMax: parseInt(process.env.FACTORY_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat("0.5"), // 30%
        manager: process.env.FACTORY_MANAGER_PRIVATE_KEY,
        rpc:
            process.env.NODE_ENV == "production"
                ? nodeEnv.ETH_RPC
                : nodeEnv.ETH_RPC,
        network: "ethereum",
        chainID: 1,
    },
    rtfkt: {
        mainnetAddress: "0xb7be4001bff2c5f4a61dd2435e4c9a19d8d12343",
        json: rtfktPodsContract,
        allowedMinter: process.env.FACTORY_ALLOWED_MINTER_ADDRESS
            ? process.env.FACTORY_ALLOWED_MINTER_ADDRESS.split(",")
            : [
                  "0xBeb171bA24e66014F356Bca0DB05329EFea14964",
                  "0x76DB02500F7631d57BC2DcDCa9d4cf782b99E119",
              ],
        minterNonceMax: parseInt(process.env.FACTORY_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat("0.5"), // 30%
        rpc:
            nodeEnv.ETH_RPC,
        network: "ethereum",
        chainID: 1,
    },
    exopods: {
        mainnetAddress: "0x895554bc4f48fe1c2bf5c198bfa3513da538f86b",
        json: exoPodsContract,
        allowedMinter: process.env.FACTORY_ALLOWED_MINTER_ADDRESS
            ? process.env.FACTORY_ALLOWED_MINTER_ADDRESS.split(",")
            : [
                  "0xBeb171bA24e66014F356Bca0DB05329EFea14964",
                  "0x76DB02500F7631d57BC2DcDCa9d4cf782b99E119",
              ],
        minterNonceMax: parseInt(process.env.FACTORY_MINTER_MAX_NONCE || "99"),
        cyberShares: parseFloat("0.5"), // 30%
        rpc:
            nodeEnv.ETH_RPC,
        network: "ethereum",
        chainID: 1,
    },
    pinata: {
        apiKey: process.env.PINATA_API_KEY,
        apiSecret: process.env.PINATA_API_SECRET,
        jwt: process.env.PINATA_JWT_KEY,
        externalUrlBase:
            process.env.PINATA_EXTERNAL_URL_BASE ||
            "https://oncyber.io/destinations/",
    },
    biconomyApiKey:
        process.env.NEXT_PUBLIC_BICONOMY_API_KEY,
    currentContract: process.env.NEXT_PUBLIC_CONTRACT_CURRENT || "factory",
};

export default config;
