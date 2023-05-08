// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20VotesComp.sol";

contract MockINST is ERC20VotesComp {
    constructor() ERC20("INST", "INST") ERC20Permit("INST") {}

    function mint(address user, uint256 amount) external {
        _mint(user, amount);
    }
}
