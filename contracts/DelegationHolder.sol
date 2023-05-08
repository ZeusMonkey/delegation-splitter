// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "./interfaces/IDelegationHolder.sol";

contract DelegationHolder is Ownable, IDelegationHolder {
    using SafeERC20 for IERC20;

    address public immutable delegatee;
    IERC20 public immutable instToken;

    constructor(address _instToken, address _delegatee) {
        delegatee = _delegatee;
        instToken = IERC20(_instToken);

        IVotes(_instToken).delegate(_delegatee);
    }

    function withdraw(address to, uint256 amount) external override onlyOwner {
        instToken.safeTransfer(to, amount);
    }
}
