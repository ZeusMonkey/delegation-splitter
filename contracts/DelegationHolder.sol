// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "./interfaces/IDelegationHolder.sol";
import "./libraries/Errors.sol";

contract DelegationHolder is Ownable, IDelegationHolder {
    using SafeERC20 for IERC20;

    address public delegatee;
    IERC20 public instToken;

    function initialize(address _instToken, address _delegatee)
        external
        override
        onlyOwner
    {
        if (address(instToken) != address(0) || delegatee != address(0)) {
            revert Errors.AlreadyInitialized();
        }
        if (_instToken == address(0) || _delegatee == address(0)) {
            revert Errors.ZeroAddress();
        }
        delegatee = _delegatee;
        instToken = IERC20(_instToken);

        IVotes(_instToken).delegate(_delegatee);
    }

    function withdraw(address to, uint256 amount) external override onlyOwner {
        if (to == address(0)) {
            revert Errors.ZeroAddress();
        }
        if (amount == 0) {
            revert Errors.ZeroAmount();
        }

        instToken.safeTransfer(to, amount);
    }
}
