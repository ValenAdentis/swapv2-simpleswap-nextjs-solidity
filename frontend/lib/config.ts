import { defineChain } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

export const hardhat = defineChain({
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
  name: "Hardhat Local",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545"]
    }
  }
});

export const config = createConfig({
  chains: [hardhat],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545"
    )
  }
});

export const addresses = {
  factory: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "") as `0x${string}`,
  router: (process.env.NEXT_PUBLIC_ROUTER_ADDRESS || "") as `0x${string}`,
  weth: (process.env.NEXT_PUBLIC_WETH_ADDRESS || "") as `0x${string}`,
  tokenA: (process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS || "") as `0x${string}`,
  tokenB: (process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS || "") as `0x${string}`
};

export const configured =
  addresses.factory.length === 42 &&
  addresses.router.length === 42 &&
  addresses.weth.length === 42 &&
  addresses.tokenA.length === 42 &&
  addresses.tokenB.length === 42;