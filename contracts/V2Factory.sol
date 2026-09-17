// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./V2Pair.sol";

contract V2Factory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair,
        uint256 allPairsLength
    );

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair)
    {
        require(tokenA != address(0) && tokenB != address(0), "ZERO_ADDRESS");
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        require(getPair[tokenA][tokenB] == address(0), "PAIR_EXISTS");

        (address token0, address token1) =
            tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        V2Pair newPair = new V2Pair{salt: salt}();
        newPair.initialize(token0, token1);

        pair = address(newPair);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}