"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  zeroAddress,
  type Address
} from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract
} from "wagmi";
import { addresses } from "../lib/config";
import { erc20Abi, routerAbi } from "../lib/abi";

type Token = {
  symbol: string;
  address: Address;
  native?: boolean;
  decimals: number;
};

const tokens: Token[] = [
  { symbol: "ETH", address: zeroAddress, native: true, decimals: 18 },
  { symbol: "dUSD", address: addresses.tokenA, decimals: 18 },
  { symbol: "dEUR", address: addresses.tokenB, decimals: 18 }
];

export function SwapCard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [input, setInput] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [from, setFrom] = useState<Token>(tokens[1]);
  const [to, setTo] = useState<Token>(tokens[2]);
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const fromBalance = useBalance({
    address,
    token: from.native ? undefined : from.address,
    query: { enabled: Boolean(address) }
  });

  const toBalance = useBalance({
    address,
    token: to.native ? undefined : to.address,
    query: { enabled: Boolean(address) }
  });

  const inputAmount = useMemo(() => {
    if (!input || Number(input) <= 0) return 0n;
    try {
      return parseUnits(input, from.decimals);
    } catch {
      return 0n;
    }
  }, [input, from.decimals]);

  const path = useMemo<Address[]>(() => {
    const a = from.native ? addresses.weth : from.address;
    const b = to.native ? addresses.weth : to.address;
    return [a, b];
  }, [from, to]);

  const { data: allowance } = useReadContract({
    address: from.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, addresses.router] : undefined,
    query: {
      enabled:
        Boolean(address) &&
        !from.native &&
        from.address !== zeroAddress &&
        addresses.router.length === 42
    }
  });

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      if (!address || inputAmount === 0n || from.address === to.address) {
        setQuote("");
        return;
      }

      try {
        const amounts = await publicClient?.readContract({
          address: addresses.router,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [inputAmount, path]
        });

        if (!cancelled && amounts) {
          setQuote(formatUnits(amounts[amounts.length - 1], to.decimals));
        }
      } catch {
        if (!cancelled) setQuote("");
      }
    }

    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [address, inputAmount, path, publicClient, from.address, to.address, to.decimals]);

  async function approveIfNeeded() {
    if (from.native || !address || !allowance || allowance >= inputAmount) return;

    setStatus("Waiting for approval...");
    const hash = await writeContractAsync({
      address: from.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [addresses.router, 2n ** 256n - 1n]
    });

    await publicClient?.waitForTransactionReceipt({ hash });
  }

  async function swap() {
    if (!address || inputAmount === 0n || !quote) return;

    try {
      setBusy(true);
      setStatus("Preparing swap...");
      await approveIfNeeded();

      const quoted = parseUnits(quote, to.decimals);
      const minimum =
        (quoted * BigInt(Math.max(0, 10000 - Math.round(Number(slippage) * 100)))) /
        10000n;

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      setStatus("Confirm the swap in your wallet...");

      let hash: `0x${string}`;

      if (from.native) {
        hash = await writeContractAsync({
          address: addresses.router,
          abi: routerAbi,
          functionName: "swapExactETHForTokens",
          args: [minimum, path, address, deadline],
          value: inputAmount
        });
      } else if (to.native) {
        hash = await writeContractAsync({
          address: addresses.router,
          abi: routerAbi,
          functionName: "swapExactTokensForETH",
          args: [inputAmount, minimum, path, address, deadline]
        });
      } else {
        hash = await writeContractAsync({
          address: addresses.router,
          abi: routerAbi,
          functionName: "swapExactTokensForTokens",
          args: [inputAmount, minimum, path, address, deadline]
        });
      }

      setStatus("Waiting for confirmation...");
      await publicClient?.waitForTransactionReceipt({ hash });
      setStatus(`Swap confirmed: ${hash.slice(0, 10)}…`);
      setInput("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  function flip() {
    setFrom(to);
    setTo(from);
    setInput("");
    setQuote("");
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">TRADE</p>
          <h2>Swap</h2>
        </div>
        <span className="fee">0.30% fee</span>
      </div>

      <div className="field">
        <label>From</label>
        <div className="input-row">
          <input
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0.0"
          />
          <select
            value={from.symbol}
            onChange={(e) => {
              const next = tokens.find((t) => t.symbol === e.target.value);
              if (next && next.symbol !== to.symbol) setFrom(next);
            }}
          >
            {tokens.map((t) => (
              <option key={t.symbol}>{t.symbol}</option>
            ))}
          </select>
        </div>
        <div className="balance">
          Balance:{" "}
          {fromBalance.data
            ? `${Number(formatUnits(fromBalance.data.value, fromBalance.data.decimals)).toFixed(4)} ${from.symbol}`
            : "—"}
        </div>
      </div>

      <button className="flip" onClick={flip} aria-label="Reverse pair">
        ↓↑
      </button>

      <div className="field">
        <label>To</label>
        <div className="input-row">
          <input value={quote} readOnly placeholder="0.0" />
          <select
            value={to.symbol}
            onChange={(e) => {
              const next = tokens.find((t) => t.symbol === e.target.value);
              if (next && next.symbol !== from.symbol) setTo(next);
            }}
          >
            {tokens.map((t) => (
              <option key={t.symbol}>{t.symbol}</option>
            ))}
          </select>
        </div>
        <div className="balance">
          Balance:{" "}
          {toBalance.data
            ? `${Number(formatUnits(toBalance.data.value, toBalance.data.decimals)).toFixed(4)} ${to.symbol}`
            : "—"}
        </div>
      </div>

      <div className="settings">
        <label>
          Slippage
          <select value={slippage} onChange={(e) => setSlippage(e.target.value)}>
            <option value="0.1">0.1%</option>
            <option value="0.5">0.5%</option>
            <option value="1">1%</option>
            <option value="2">2%</option>
          </select>
        </label>
      </div>

      <button
        className="button primary full"
        disabled={busy || !address || inputAmount === 0n || !quote}
        onClick={swap}
      >
        {!address ? "Connect wallet" : busy ? "Processing..." : "Swap"}
      </button>

      {status && <p className="status">{status}</p>}
    </section>
  );
}