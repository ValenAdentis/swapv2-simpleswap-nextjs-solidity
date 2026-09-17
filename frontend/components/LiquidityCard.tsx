"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatUnits,
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
import { erc20Abi, factoryAbi, pairAbi, routerAbi } from "../lib/abi";

const maxUint = 2n ** 256n - 1n;

export function LiquidityCard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [pairType, setPairType] = useState<"token-token" | "token-eth">("token-token");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [removePercent, setRemovePercent] = useState("100");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const tokenA = addresses.tokenA;
  const tokenB = addresses.tokenB;
  const second = pairType === "token-eth" ? addresses.weth : tokenB;

  const tokenABalance = useBalance({
    address,
    token: tokenA,
    query: { enabled: Boolean(address) }
  });

  const tokenBBalance = useBalance({
    address,
    token: second,
    query: { enabled: Boolean(address) }
  });

  const { data: pair } = useReadContract({
    address: addresses.factory,
    abi: factoryAbi,
    functionName: "getPair",
    args: [tokenA, second],
    query: { enabled: addresses.factory.length === 42 }
  });
  console.log("LIQUIDITY ADDRESSES", addresses);
  const pairAddress = (pair || zeroAddress) as Address;

  const { data: lpBalance } = useReadContract({
    address: pairAddress,
    abi: pairAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address) && pairAddress !== zeroAddress
    }
  });

  const { data: tokenAllowance } = useReadContract({
    address: tokenA,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, addresses.router] : undefined,
    query: { enabled: Boolean(address) }
  });

  const { data: secondAllowance } = useReadContract({
    address: second,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, addresses.router] : undefined,
    query: { enabled: Boolean(address) && pairType === "token-token" }
  });

  const addSecondAmount = useMemo(() => {
    try {
      return pairType === "token-eth"
        ? parseUnits(amountB || "0", 18)
        : parseUnits(amountB || "0", 18);
    } catch {
      return 0n;
    }
  }, [amountB, pairType]);

  async function approveToken(token: Address, amount: bigint, current?: bigint) {
    if (current !== undefined && current >= amount) return;
    setStatus(`Approving ${token === tokenA ? "dUSD" : "dEUR"}...`);

    const hash = await writeContractAsync({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [addresses.router, maxUint]
    });

    await publicClient?.waitForTransactionReceipt({ hash });
  }

  async function add() {
    if (!address) return;

    try {
      setBusy(true);
      setStatus("Preparing liquidity transaction...");

      const a = parseUnits(amountA || "0", 18);
      const b = addSecondAmount;
      if (a <= 0n || b <= 0n) throw new Error("Enter both amounts.");

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      await approveToken(tokenA, a, tokenAllowance);

      if (pairType === "token-token") {
        await approveToken(second, b, secondAllowance);

        setStatus("Confirm add-liquidity transaction...");
        const hash = await writeContractAsync({
          address: addresses.router,
          abi: routerAbi,
          functionName: "addLiquidity",
          args: [tokenA, second, a, b, 0n, 0n, address, deadline]
        });

        await publicClient?.waitForTransactionReceipt({ hash });
        setStatus(`Liquidity added: ${hash.slice(0, 10)}…`);
      } else {
        setStatus("Confirm add-liquidity ETH transaction...");
        const hash = await writeContractAsync({
          address: addresses.router,
          abi: routerAbi,
          functionName: "addLiquidityETH",
          args: [tokenA, a, 0n, 0n, address, deadline],
          value: b
        });

        await publicClient?.waitForTransactionReceipt({ hash });
        setStatus(`Liquidity added: ${hash.slice(0, 10)}…`);
      }

      setAmountA("");
      setAmountB("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!address || pairAddress === zeroAddress || !lpBalance || lpBalance === 0n) return;

    try {
      setBusy(true);
      setStatus("Approving LP tokens...");

      const amount = (lpBalance * BigInt(Math.round(Number(removePercent) * 100))) / 10000n;

      const approvalHash = await writeContractAsync({
        address: pairAddress,
        abi: pairAbi,
        functionName: "approve",
        args: [addresses.router, amount]
      });
      await publicClient?.waitForTransactionReceipt({ hash: approvalHash });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      setStatus("Confirm remove-liquidity transaction...");

      const hash =
        pairType === "token-eth"
          ? await writeContractAsync({
              address: addresses.router,
              abi: routerAbi,
              functionName: "removeLiquidityETH",
              args: [tokenA, amount, 0n, 0n, address, deadline]
            })
          : await writeContractAsync({
              address: addresses.router,
              abi: routerAbi,
              functionName: "removeLiquidity",
              args: [tokenA, second, amount, 0n, 0n, address, deadline]
            });

      await publicClient?.waitForTransactionReceipt({ hash });
      setStatus(`Liquidity removed: ${hash.slice(0, 10)}…`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">LIQUIDITY</p>
          <h2>Pool</h2>
        </div>
        <span className="fee">LP fee 0.30%</span>
      </div>

      <div className="tabs">
        <button
          className={pairType === "token-token" ? "tab active" : "tab"}
          onClick={() => setPairType("token-token")}
        >
          dUSD / dEUR
        </button>
        <button
          className={pairType === "token-eth" ? "tab active" : "tab"}
          onClick={() => setPairType("token-eth")}
        >
          dUSD / ETH
        </button>
      </div>

      <div className="field">
        <label>dUSD amount</label>
        <input
          inputMode="decimal"
          value={amountA}
          onChange={(e) => setAmountA(e.target.value)}
          placeholder="0.0"
        />
        <div className="balance">
          Balance:{" "}
          {tokenABalance.data
            ? `${Number(formatUnits(tokenABalance.data.value, 18)).toFixed(4)} dUSD`
            : "—"}
        </div>
      </div>

      <div className="field">
        <label>{pairType === "token-eth" ? "ETH amount" : "dEUR amount"}</label>
        <input
          inputMode="decimal"
          value={amountB}
          onChange={(e) => setAmountB(e.target.value)}
          placeholder="0.0"
        />
        <div className="balance">
          Balance:{" "}
          {tokenBBalance.data
            ? `${Number(formatUnits(tokenBBalance.data.value, 18)).toFixed(4)} ${pairType === "token-eth" ? "ETH" : "dEUR"}`
            : "—"}
        </div>
      </div>

      <button className="button primary full" disabled={busy || !address} onClick={add}>
        {busy ? "Processing..." : "Add liquidity"}
      </button>

      <div className="divider" />

      <div className="field">
        <label>Remove liquidity</label>
        <select value={removePercent} onChange={(e) => setRemovePercent(e.target.value)}>
          <option value="25">25%</option>
          <option value="50">50%</option>
          <option value="75">75%</option>
          <option value="100">100%</option>
        </select>
        <div className="balance">
          LP balance: {lpBalance ? formatUnits(lpBalance, 18) : "0"}
        </div>
      </div>

      <button
        className="button danger full"
        disabled={busy || !address || !lpBalance || lpBalance === 0n}
        onClick={remove}
      >
        Remove liquidity
      </button>

      {status && <p className="status">{status}</p>}
    </section>
  );
}