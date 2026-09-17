// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./V2Factory.sol";
import "./V2Pair.sol";
import "./WETH9.sol";

contract V2Router {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address payable public immutable WETH;

    constructor(address _factory, address _WETH) {
        require(_factory != address(0), "ZERO_FACTORY");
        require(_WETH != address(0), "ZERO_WETH");

        factory = _factory;
        WETH = payable(_WETH);
    }

    receive() external payable {}

    function _pair(address a, address b) internal view returns (V2Pair pair) {
        address pairAddress = V2Factory(factory).getPair(a, b);
        require(pairAddress != address(0), "PAIR_NOT_FOUND");
        pair = V2Pair(pairAddress);
    }

    function _validatePath(address[] calldata path) internal pure {
        require(path.length >= 2, "PATH");
        for (uint256 i = 0; i + 1 < path.length; i++) {
            require(path[i] != address(0) && path[i] != path[i + 1], "BAD_PATH");
        }
        require(path[path.length - 1] != address(0), "BAD_PATH");
    }

    function _validateTo(address to) internal pure {
        require(to != address(0), "INVALID_TO");
    }

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) public pure returns (uint256) {
        require(amountA > 0 && reserveA > 0 && reserveB > 0, "BAD_QUOTE");
        return amountA * reserveB / reserveA;
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0 && reserveIn > 0 && reserveOut > 0, "BAD_INPUT");
        uint256 amountInWithFee = amountIn * 997;
        return
            amountInWithFee * reserveOut /
            (reserveIn * 1000 + amountInWithFee);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(
            amountOut > 0 && reserveIn > 0 && reserveOut > amountOut,
            "BAD_INPUT"
        );

        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        return numerator / denominator + 1;
    }

    function _amountOutForPair(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256) {
        V2Pair pair = _pair(tokenIn, tokenOut);
        (uint112 r0, uint112 r1, ) = pair.getReserves();

        (uint256 reserveIn, uint256 reserveOut) =
            tokenIn == pair.token0()
                ? (uint256(r0), uint256(r1))
                : (uint256(r1), uint256(r0));

        return getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function _amountInForPair(
        uint256 amountOut,
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256) {
        V2Pair pair = _pair(tokenIn, tokenOut);
        (uint112 r0, uint112 r1, ) = pair.getReserves();

        (uint256 reserveIn, uint256 reserveOut) =
            tokenIn == pair.token0()
                ? (uint256(r0), uint256(r1))
                : (uint256(r1), uint256(r0));

        return getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts) {
        _validatePath(path);
        require(amountIn > 0, "AMOUNT_IN");

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i + 1 < path.length; i++) {
            amounts[i + 1] = _amountOutForPair(
                amounts[i],
                path[i],
                path[i + 1]
            );
        }
    }

    function getAmountsIn(
        uint256 amountOut,
        address[] calldata path
    ) external view returns (uint256[] memory amounts) {
        _validatePath(path);
        require(amountOut > 0, "AMOUNT_OUT");

        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;

        for (uint256 i = path.length - 1; i > 0; i--) {
            amounts[i - 1] = _amountInForPair(
                amounts[i],
                path[i - 1],
                path[i]
            );
        }
    }

    function _swap(
        uint256[] memory amounts,
        address[] calldata path,
        address to
    ) internal {
        for (uint256 i = 0; i + 1 < path.length; i++) {
            V2Pair pair = _pair(path[i], path[i + 1]);

            address token0 = pair.token0();
            uint256 amountOut = amounts[i + 1];

            uint256 amount0Out = path[i] == token0 ? 0 : amountOut;
            uint256 amount1Out = path[i] == token0 ? amountOut : 0;

            address nextTo = i + 2 < path.length
                ? address(_pair(path[i + 1], path[i + 2]))
                : to;

            pair.swap(amount0Out, amount1Out, nextTo);
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);
        _validatePath(path);

        amounts = this.getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "SLIPPAGE");

        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            address(_pair(path[0], path[1])),
            amountIn
        );

        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);
        _validatePath(path);

        amounts = this.getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "EXCESSIVE_INPUT");

        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            address(_pair(path[0], path[1])),
            amounts[0]
        );

        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);
        _validatePath(path);
        require(path[0] == WETH, "PATH");
        require(msg.value > 0, "NO_ETH");

        amounts = this.getAmountsOut(msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "SLIPPAGE");

        WETH9(WETH).deposit{value: msg.value}();
        IERC20(WETH).safeTransfer(
            address(_pair(path[0], path[1])),
            msg.value
        );

        _swap(amounts, path, to);
    }

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);
        _validatePath(path);
        require(path[0] == WETH, "PATH");

        amounts = this.getAmountsIn(amountOut, path);
        require(amounts[0] <= msg.value, "EXCESSIVE_ETH");

        WETH9(WETH).deposit{value: amounts[0]}();
        IERC20(WETH).safeTransfer(
            address(_pair(path[0], path[1])),
            amounts[0]
        );

        _swap(amounts, path, to);

        if (msg.value > amounts[0]) {
            _safeTransferETH(msg.sender, msg.value - amounts[0]);
        }
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);
        _validatePath(path);
        require(path[path.length - 1] == WETH, "PATH");

        amounts = this.getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "SLIPPAGE");

        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            address(_pair(path[0], path[1])),
            amountIn
        );

        _swap(amounts, path, address(this));

        uint256 amountOut = amounts[amounts.length - 1];
        WETH9(WETH).withdraw(amountOut);
        _safeTransferETH(to, amountOut);
    }

    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);
        _validatePath(path);
        require(path[path.length - 1] == WETH, "PATH");

        amounts = this.getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "EXCESSIVE_INPUT");

        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            address(_pair(path[0], path[1])),
            amounts[0]
        );

        _swap(amounts, path, address(this));

        WETH9(WETH).withdraw(amountOut);
        _safeTransferETH(to, amountOut);
    }

    function _addLiquidity(
        address a,
        address b,
        uint256 aDesired,
        uint256 bDesired,
        uint256 aMin,
        uint256 bMin
    ) internal returns (address pair, uint256 aUsed, uint256 bUsed) {
        require(a != address(0) && b != address(0) && a != b, "BAD_TOKENS");

        pair = V2Factory(factory).getPair(a, b);
        if (pair == address(0)) {
            pair = V2Factory(factory).createPair(a, b);
        }

        (uint112 r0, uint112 r1, ) = V2Pair(pair).getReserves();

        (uint256 reserveA, uint256 reserveB) =
            a == V2Pair(pair).token0()
                ? (uint256(r0), uint256(r1))
                : (uint256(r1), uint256(r0));

        if (reserveA == 0 && reserveB == 0) {
            aUsed = aDesired;
            bUsed = bDesired;
        } else {
            uint256 bOptimal = quote(aDesired, reserveA, reserveB);

            if (bOptimal <= bDesired) {
                require(bOptimal >= bMin, "B_MIN");
                aUsed = aDesired;
                bUsed = bOptimal;
            } else {
                uint256 aOptimal = quote(bDesired, reserveB, reserveA);
                require(aOptimal >= aMin, "A_MIN");
                aUsed = aOptimal;
                bUsed = bDesired;
            }
        }

        require(aUsed >= aMin && bUsed >= bMin, "MIN");
    }

    function addLiquidity(
        address a,
        address b,
        uint256 aDesired,
        uint256 bDesired,
        uint256 aMin,
        uint256 bMin,
        address to,
        uint256 deadline
    ) external returns (
        uint256 aUsed,
        uint256 bUsed,
        uint256 liquidity
    ) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);

        (address pair, uint256 usedA, uint256 usedB) = _addLiquidity(
            a,
            b,
            aDesired,
            bDesired,
            aMin,
            bMin
        );

        IERC20(a).safeTransferFrom(msg.sender, pair, usedA);
        IERC20(b).safeTransferFrom(msg.sender, pair, usedB);

        liquidity = V2Pair(pair).mint(to);
        aUsed = usedA;
        bUsed = usedB;
    }

    function addLiquidityETH(
        address token,
        uint256 tokenDesired,
        uint256 tokenMin,
        uint256 ethMin,
        address to,
        uint256 deadline
    ) external payable returns (
        uint256 tokenUsed,
        uint256 ethUsed,
        uint256 liquidity
    ) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);
        require(msg.value > 0, "NO_ETH");

        (address pair, uint256 usedToken, uint256 usedETH) = _addLiquidity(
            token,
            WETH,
            tokenDesired,
            msg.value,
            tokenMin,
            ethMin
        );

        IERC20(token).safeTransferFrom(msg.sender, pair, usedToken);

        WETH9(WETH).deposit{value: usedETH}();
        IERC20(WETH).safeTransfer(pair, usedETH);

        liquidity = V2Pair(pair).mint(to);

        if (msg.value > usedETH) {
            _safeTransferETH(msg.sender, msg.value - usedETH);
        }

        tokenUsed = usedToken;
        ethUsed = usedETH;
    }

    function removeLiquidity(
        address a,
        address b,
        uint256 liquidity,
        uint256 aMin,
        uint256 bMin,
        address to,
        uint256 deadline
    ) public returns (uint256 aOut, uint256 bOut) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);

        V2Pair pair = _pair(a, b);
        pair.transferFrom(msg.sender, address(pair), liquidity);

        (uint256 amount0, uint256 amount1) = pair.burn(to);

        (aOut, bOut) = a == pair.token0()
            ? (amount0, amount1)
            : (amount1, amount0);

        require(aOut >= aMin && bOut >= bMin, "SLIPPAGE");
    }

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 tokenMin,
        uint256 ethMin,
        address to,
        uint256 deadline
    ) external returns (uint256 tokenOut, uint256 ethOut) {
        require(block.timestamp <= deadline, "EXPIRED");
        _validateTo(to);

        V2Pair pair = _pair(token, WETH);
        pair.transferFrom(msg.sender, address(pair), liquidity);

        (uint256 amount0, uint256 amount1) = pair.burn(address(this));

        (tokenOut, ethOut) = token == pair.token0()
            ? (amount0, amount1)
            : (amount1, amount0);

        require(tokenOut >= tokenMin && ethOut >= ethMin, "SLIPPAGE");

        IERC20(token).safeTransfer(to, tokenOut);
        WETH9(WETH).withdraw(ethOut);
        _safeTransferETH(to, ethOut);
    }

    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "ETH_TRANSFER_FAILED");
    }
}