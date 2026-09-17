# Contracts

`V2Factory.sol` deploys pairs with CREATE2.

`V2Pair.sol` is an educational constant-product AMM pair with:
- 0.30% swap fee
- ERC-20 LP shares
- minimum locked liquidity
- reentrancy protection
- SafeERC20 transfers

`V2Router.sol` handles:
- quotes
- exact-input/output token swaps
- ETH/WETH swaps
- adding/removing liquidity

`WETH9.sol` wraps and unwraps ETH.

This implementation is intentionally smaller than production Uniswap V2 and is not audited.