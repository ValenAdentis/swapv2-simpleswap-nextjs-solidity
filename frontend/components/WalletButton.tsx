"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { hardhat } from "../lib/config";

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const connector = connectors[0];

  if (!isConnected) {
    return (
      <button
        className="button primary"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
      >
        {isPending ? "Connecting..." : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== hardhat.id) {
    return (
      <button
        className="button warning"
        disabled={switching}
        onClick={() => switchChain({ chainId: hardhat.id })}
      >
        {switching ? "Switching..." : "Switch to Hardhat"}
      </button>
    );
  }

  return (
    <button className="button ghost" onClick={() => disconnect()}>
      {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Disconnect"}
    </button>
  );
}