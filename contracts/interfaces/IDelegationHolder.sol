// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IDelegationHolder {
    function initialize(address _instToken, address _delegatee) external;

    function withdraw(address to, uint256 amount) external;
}
