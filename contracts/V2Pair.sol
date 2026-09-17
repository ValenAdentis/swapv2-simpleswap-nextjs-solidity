// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract V2Pair is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    address public immutable factory;
    address public token0;
    address public token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor() ERC20("V2 DEX LP", "V2-LP") {
        factory = msg.sender;
    }

    function initialize(address a, address b) external {
        require(msg.sender == factory, "FORBIDDEN");
        require(token0 == address(0) && token1 == address(0), "INITIALIZED");
        require(a != address(0) && b != address(0) && a != b, "INVALID_TOKENS");
        (token0, token1) = a < b ? (a, b) : (b, a);
    }

    function getReserves()
        public
        view
        returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)
    {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function _update(uint256 balance0, uint256 balance1) private {
        require(
            balance0 <= type(uint112).max && balance1 <= type(uint112).max,
            "OVERFLOW"
        );

        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);

        emit Sync(reserve0, reserve1);
    }

    function mint(address to) external nonReentrant returns (uint256 liquidity) {
        require(to != address(0), "INVALID_TO");

        (uint112 r0, uint112 r1, ) = getReserves();
        uint256 b0 = IERC20(token0).balanceOf(address(this));
        uint256 b1 = IERC20(token1).balanceOf(address(this));

        uint256 amount0 = b0 - r0;
        uint256 amount1 = b1 - r1;

        uint256 totalSupply_ = totalSupply();

        if (totalSupply_ == 0) {
            uint256 rootK = _sqrt(amount0 * amount1);
            require(rootK > MINIMUM_LIQUIDITY, "INSUFFICIENT_LIQUIDITY_MINTED");

            liquidity = rootK - MINIMUM_LIQUIDITY;

            // OZ ERC20 forbids minting to address(0), so the minimum LP is
            // permanently locked at a dead address in this educational pair.
            _mint(address(0x000000000000000000000000000000000000dEaD), MINIMUM_LIQUIDITY);
        } else {
            require(r0 > 0 && r1 > 0, "BAD_RESERVES");
            liquidity = _min(
                amount0 * totalSupply_ / r0,
                amount1 * totalSupply_ / r1
            );
            require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        }

        _mint(to, liquidity);
        _update(b0, b1);

        emit Mint(msg.sender, amount0, amount1);
    }

    function burn(address to)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        require(to != address(0), "INVALID_TO");

        (uint112 r0, uint112 r1, ) = getReserves();
        uint256 b0 = IERC20(token0).balanceOf(address(this));
        uint256 b1 = IERC20(token1).balanceOf(address(this));

        uint256 liquidity = balanceOf(address(this));
        uint256 totalSupply_ = totalSupply();
        require(liquidity > 0 && totalSupply_ > 0, "NO_LIQUIDITY");

        amount0 = liquidity * b0 / totalSupply_;
        amount1 = liquidity * b1 / totalSupply_;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_LIQUIDITY_BURNED");

        _burn(address(this), liquidity);

        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);

        uint256 newB0 = IERC20(token0).balanceOf(address(this));
        uint256 newB1 = IERC20(token1).balanceOf(address(this));
        _update(newB0, newB1);

        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to
    ) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "INSUFFICIENT_OUTPUT");

        (uint112 r0, uint112 r1, ) = getReserves();
        require(amount0Out < r0 && amount1Out < r1, "INSUFFICIENT_LIQUIDITY");
        require(to != address(0) && to != token0 && to != token1, "INVALID_TO");

        if (amount0Out > 0) IERC20(token0).safeTransfer(to, amount0Out);
        if (amount1Out > 0) IERC20(token1).safeTransfer(to, amount1Out);

        uint256 b0 = IERC20(token0).balanceOf(address(this));
        uint256 b1 = IERC20(token1).balanceOf(address(this));

        uint256 amount0In = b0 > (r0 - amount0Out)
            ? b0 - (r0 - amount0Out)
            : 0;
        uint256 amount1In = b1 > (r1 - amount1Out)
            ? b1 - (r1 - amount1Out)
            : 0;

        require(amount0In > 0 || amount1In > 0, "INSUFFICIENT_INPUT");

        uint256 balance0Adjusted = b0 * 1000 - amount0In * 3;
        uint256 balance1Adjusted = b1 * 1000 - amount1In * 3;

        require(
            balance0Adjusted * balance1Adjusted >=
                uint256(r0) * uint256(r1) * 1_000_000,
            "K"
        );

        _update(b0, b1);

        emit Swap(
            msg.sender,
            amount0In,
            amount1In,
            amount0Out,
            amount1Out,
            to
        );
    }

    function skim(address to) external {
        require(to != address(0), "INVALID_TO");

        uint256 b0 = IERC20(token0).balanceOf(address(this));
        uint256 b1 = IERC20(token1).balanceOf(address(this));

        if (b0 > reserve0) IERC20(token0).safeTransfer(to, b0 - reserve0);
        if (b1 > reserve1) IERC20(token1).safeTransfer(to, b1 - reserve1);
    }

    function sync() external {
        _update(
            IERC20(token0).balanceOf(address(this)),
            IERC20(token1).balanceOf(address(this))
        );
    }

    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x < y ? x : y;
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}