// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// We use OpenZeppelin's audited libraries instead of writing ERC-20
// or owner-only logic from scratch. They are the standard building
// blocks every Ethereum project relies on.
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * ChannelToken
 * ------------
 * One ERC-20 token per YouTube channel. Think of it as "shares" of
 * that channel. Each creator gets their own ChannelToken contract.
 *
 *   - Only the creator (owner) can mint new tokens.
 *   - Total supply can never exceed `cap` (no surprise dilution).
 *   - Anyone who holds tokens can burn (destroy) their own.
 */
contract ChannelToken is ERC20, Ownable {

    // ------------------------------------------------------------
    //  STORAGE
    // ------------------------------------------------------------

    /// YouTube channel id this token represents (e.g. "UCxxxxxxxx").
    string public channelId;

    /// Maximum number of tokens that can ever exist for this channel.
    uint256 public immutable cap;

    // ------------------------------------------------------------
    //  EVENTS
    // ------------------------------------------------------------

    event ChannelTokenMinted(address indexed to, uint256 amount);
    event ChannelTokenBurned(address indexed from, uint256 amount);

    // ------------------------------------------------------------
    //  CONSTRUCTOR — runs once when the contract is deployed
    // ------------------------------------------------------------

    constructor(
        string memory name_,           // e.g. "Acube Coin"
        string memory symbol_,         // e.g. "ACUBE"
        string memory channelId_,      // YouTube channel id
        address creator_,              // wallet that owns this token
        uint256 cap_,                  // max total supply
        uint256 initialSupply_         // tokens minted to the creator right away
    )
        ERC20(name_, symbol_)
        Ownable(creator_)
    {
        // Sanity checks before we set anything in storage.
        require(creator_ != address(0), "creator required");
        require(cap_ > 0,               "cap must be > 0");
        require(initialSupply_ <= cap_, "initial supply > cap");

        channelId = channelId_;
        cap       = cap_;

        // If the deployer asked for an initial supply, give it to the creator now.
        if (initialSupply_ > 0) {
            _mint(creator_, initialSupply_);
            emit ChannelTokenMinted(creator_, initialSupply_);
        }
    }

    // ------------------------------------------------------------
    //  MINT — only the creator (owner) can call this
    // ------------------------------------------------------------

    function mint(address to, uint256 amount) external onlyOwner {
        // Make sure we never exceed the maximum supply.
        require(totalSupply() + amount <= cap, "cap reached");

        _mint(to, amount);
        emit ChannelTokenMinted(to, amount);
    }

    // ------------------------------------------------------------
    //  BURN — anyone can destroy their OWN tokens
    // ------------------------------------------------------------

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit ChannelTokenBurned(msg.sender, amount);
    }
}
