// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IDelegationHolder.sol";
import "./DelegationHolder.sol";
import "./libraries/Errors.sol";

contract DelegationSplitter is Ownable {
    using SafeERC20 for IERC20;

    event Delegated(address indexed delegatee, uint256 amount);
    event UnDelegated(address indexed delegatee, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // inst token address
    IERC20 public immutable instToken;

    bytes32 public constant INIT_CODE_HASH =
        keccak256(abi.encodePacked(type(DelegationHolder).creationCode));

    /**
     * initialize DelegationSplitter contract
     * @param _instToken INST token address
     */
    constructor(address _instToken) {
        if (_instToken == address(0)) revert Errors.ZeroAddress();
        instToken = IERC20(_instToken);
    }

    /**
     * delegate INST token voting power
     * @dev if this is first delegation to `delegatee`, create DelegationHolder contract.
     * @param delegatee Delegatee address
     * @param amount token amount to delegate
     */
    function delegate(address delegatee, uint256 amount) external onlyOwner {
        _validateZero(delegatee, amount);

        if (delegatee == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        address _delegatee = delegatee;
        uint256 _amount = amount;

        IDelegationHolder holder = _getHolder(_delegatee);

        instToken.safeTransfer(address(holder), _amount);

        emit Delegated(_delegatee, _amount);
    }

    /**
     * undelegate INST token voting power
     * @dev if `to` is address(0), withdraw tokens to current Splitter address.
     * @param delegatee Delegatee address
     * @param amount token amount to undelegate
     */
    function undelegate(
        address delegatee,
        uint256 amount,
        address to
    ) external onlyOwner {
        _validateZero(delegatee, amount);

        address _delegatee = delegatee;
        uint256 _amount = amount;

        IDelegationHolder holder = _getHolder(_delegatee);

        holder.withdraw(to == address(0) ? address(this) : to, _amount);

        emit UnDelegated(_delegatee, _amount);
    }

    /**
     * undelegate INST token from `oldDelegatee` and delegate to `newDelegatee`.
     * @param oldDelegatee Old delegatee address
     * @param newDelegatee New delegatee address
     * @param amount token amount to move delegation
     */
    function moveDelegation(
        address oldDelegatee,
        address newDelegatee,
        uint256 amount
    ) external onlyOwner {
        _validateZero(newDelegatee, amount);

        address _oldDelegatee = oldDelegatee;
        address _newDelegatee = newDelegatee;
        uint256 _amount = amount;

        IDelegationHolder oldHolder = _getHolder(_oldDelegatee);
        IDelegationHolder newHolder = _getHolder(_newDelegatee);
        oldHolder.withdraw(address(newHolder), _amount);

        emit UnDelegated(oldDelegatee, _amount);
        emit Delegated(newDelegatee, _amount);
    }

    /**
     * Withdraw INST token from Splitter contract to `to` address
     * @param to address to receive INST token
     * @param amount token amount to withdraw
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        _validateZero(to, amount);

        instToken.safeTransfer(to, amount);

        emit Withdrawn(to, amount);
    }

    /**
     * Get DelegationHolder contract associated to `delegatee`.
     * @dev if DelegationHolder contract does not exist, create new one using CREATE2.
     * @param delegatee delegatee address
     */
    function _getHolder(address delegatee)
        internal
        returns (IDelegationHolder holder)
    {
        bytes32 salt = keccak256(abi.encodePacked(delegatee));

        address holderAddr = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            hex"ff",
                            address(this),
                            salt,
                            INIT_CODE_HASH
                        )
                    )
                )
            )
        );

        if (!Address.isContract(holderAddr)) {
            new DelegationHolder{salt: salt}(address(instToken), delegatee);
        }

        holder = IDelegationHolder(holderAddr);
    }

    function _validateZero(address nonZeroAddr, uint256 nonZeroUint)
        internal
        pure
    {
        if (nonZeroAddr == address(0)) revert Errors.ZeroAddress();
        if (nonZeroUint == 0) revert Errors.ZeroAmount();
    }
}
