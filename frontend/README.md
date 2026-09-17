# V2 DEX Frontend

## Setup

1. Start Hardhat:

```bash
npx hardhat node
```

2. Deploy from the project root:

```bash
npm run deploy:local
```

3. Copy:

```text
.env.local.example -> .env.local
```

4. Paste the deployment addresses into `.env.local`.

5. Install and run:

```bash
npm install
npm run dev
```

The frontend is a local demo and expects chain ID `31337`.

## Features

- injected wallet connection
- Hardhat network switching
- token/token swap
- ETH/token swap
- token/ETH swap
- live V2 quote
- slippage control
- ERC-20 approval
- add token/token liquidity
- add token/ETH liquidity
- remove liquidity
- transaction confirmation status
