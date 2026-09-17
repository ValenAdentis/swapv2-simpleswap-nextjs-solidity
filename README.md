# V2 DEX — Clean Corrected Local Demo

This is a self-contained educational Uniswap-V2-style DEX project:

- Solidity `0.8.24`
- Hardhat
- OpenZeppelin 5
- Factory + Pair + Router + WETH
- ERC-20 token swaps
- ETH/WETH swaps
- Add/remove liquidity
- Exact-input and exact-output router paths
- SafeERC20 transfers
- Correct path/deadline/recipient validation
- Next.js + wagmi + viem frontend
- Local Hardhat deployment and tests

## Important

This is an educational/local demo, **not audited production DEX code**. It intentionally omits some production Uniswap V2 features such as protocol fee (`feeTo`) accounting, permit support, fee-on-transfer swap variants, TWAP oracle accumulators, and production-grade administrative/token-listing controls.

## Backend

```bash
npm install
npx hardhat compile
npx hardhat test
```

Start a local chain:

```bash
npx hardhat node
```

In another terminal:

```bash
npm run deploy:local
```

The deployment script prints addresses. Copy them into:

`frontend/.env.local`

Example:

```env
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_WETH_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_A_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_B_ADDRESS=0x...
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the local Next.js URL shown by the terminal.

For MetaMask, add/import the Hardhat local network:

- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency: ETH

For testing, import one of the private keys printed by `npx hardhat node`.

## What was fixed

The router no longer ignores ERC-20 transfer return values. It uses OpenZeppelin `SafeERC20`.

The router validates:
- deadlines
- path length
- zero addresses
- duplicate adjacent path tokens
- WETH endpoints for ETH routes
- non-zero recipients
- liquidity minimums
- swap slippage/input limits

ETH payouts use low-level `call` rather than Solidity `transfer`.

The pair:
- uses reentrancy protection
- validates initialization
- validates swap recipients
- checks the constant-product invariant with the 0.3% fee
- uses safe token transfers
- protects the minimum LP liquidity at a dead address because OpenZeppelin ERC20 does not allow minting to `address(0)`

The frontend includes:
- wallet connection
- network indicator
- token/ETH selection
- live quote
- slippage setting
- ERC-20 approval
- token/token swaps
- ETH/token swaps
- add liquidity
- remove liquidity
- transaction status/error display
- responsive styling
