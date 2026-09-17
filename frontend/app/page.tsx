"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "../components/WalletButton";
import { SwapCard } from "../components/SwapCard";
import { LiquidityCard } from "../components/LiquidityCard";
import { configured } from "../lib/config";

export default function Home() {
  const [tab, setTab] = useState<"swap" | "liquidity">("swap");
  const { isConnected } = useAccount();

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="brand">V2 DEX</div>
          <div className="subtitle">Local constant-product exchange</div>
        </div>
        <WalletButton />
      </header>

      {!configured && (
        <div className="notice">
          Deployment addresses are missing. Run the Hardhat deployment, then copy
          <code>frontend/.env.local.example</code> to <code>.env.local</code> and
          fill in the printed addresses.
        </div>
      )}

      <section className="hero">
        <p className="eyebrow">EDUCATIONAL V2-STYLE DEX</p>
        <h1>Swap tokens. Provide liquidity.</h1>
        <p>
          A clean local demo with safe ERC-20 transfers, WETH routes, slippage
          protection and a complete liquidity flow.
        </p>
      </section>

      <nav className="main-tabs">
        <button
          className={tab === "swap" ? "main-tab active" : "main-tab"}
          onClick={() => setTab("swap")}
        >
          Swap
        </button>
        <button
          className={tab === "liquidity" ? "main-tab active" : "main-tab"}
          onClick={() => setTab("liquidity")}
        >
          Liquidity
        </button>
      </nav>

      <div className="content">
        {tab === "swap" ? <SwapCard /> : <LiquidityCard />}
      </div>

      <footer>
        {isConnected
          ? "Wallet connected to the local demo."
          : "Connect a wallet to start testing."}
      </footer>
    </main>
  );
}