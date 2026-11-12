import { nodeEnv } from "@env";
import { ethers } from 'ethers';
import { isEthereumAddress } from "@utils/getAddrType";

export const delegateCashContract="0x00000000000076a84fef008cdabe6409d2fe638b"

export const delegateCashMinABI= [
    {
    "inputs": [{"internalType": "address","name": "delegate","type": "address"}],
    "name": "getDelegationsByDelegate",
    "outputs": [{
        "components": [
            {"internalType": "enum IDelegationRegistry.DelegationType","name": "type_","type": "uint8"},
            {"internalType": "address","name": "vault","type": "address"},
            {"internalType": "address","name": "delegate","type": "address"},
            {"internalType": "address","name": "contract_","type": "address"},
            {"internalType": "uint256","name": "tokenId","type": "uint256"}
        ],
        "internalType": "struct IDelegationRegistry.DelegationInfo[]","name": "info","type": "tuple[]"}
    ],
    "stateMutability": "view","type": "function"
},]

export const warmWalletContract="0xc3aa9bc72bd623168860a1e5c6a4530d3d80456c"

export const warmWalletMinABI = [{"inputs":[{"internalType":"address","name":"hotWallet","type":"address"}],"name":"getColdWallets","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"}] 

/*
   accounts = 
    {
        "walletId": 
            {
                walletId: "walletId"
                type: "ethereum"
            },

    }
*/
export async function getProxyWallets(accounts) {
    const proxWalletResult = {}
    try{
        const provider = new ethers.providers.JsonRpcProvider(nodeEnv.ETH_RPC);

        let contract = new ethers.Contract(delegateCashContract,delegateCashMinABI, provider);
        await Promise.all(Object.entries(accounts)
            ?.filter((x) => isEthereumAddress(x[1]?.walletId))
            ?.map(([index,value])=> (async ()=>{
                    (await contract.getDelegationsByDelegate(value?.walletId))
                        ?.filter(x=>x && x[0]==1)
                        ?.map(delegation => {
                            proxWalletResult[delegation[1]]={
                                "walletId": delegation[1],
                                "type": "ethereum",
                                "trustedDelegation": true
                            }
                        })
                })()
            ))
        
        contract = new ethers.Contract(warmWalletContract,warmWalletMinABI, provider);
        await Promise.all(Object.entries(accounts)
            ?.filter((x) => isEthereumAddress(x[1]?.walletId))
            ?.map(([index,value])=> (async ()=>{
                    (await contract.getColdWallets(value?.walletId))
                        ?.filter(x=>x)
                        ?.map(delegation => {
                            proxWalletResult[delegation]={
                                "walletId": delegation,
                                "type": "ethereum",
                                "trustedDelegation": true
                            }
                        })
                })()
            ))
    }catch(err){
        console.error(err);
    }

    return proxWalletResult
}
