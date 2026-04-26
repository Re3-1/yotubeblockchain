// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Marketplace
 * -----------
 * A simple peer-to-peer market for ChannelTokens.
 *
 *   1. A seller calls `listForSale(...)` and the contract takes their
 *      tokens into escrow at the price they chose.
 *   2. A buyer calls `buy(listingId, amount)` and pays in MATIC.
 *   3. The contract splits the payment three ways:
 *        - creator gets a royalty (e.g. 2%)
 *        - platform owner gets a fee (e.g. 1%)
 *        - seller gets the rest
 *      ...all inside one transaction. No middleman holds the money.
 *
 * "bps" stands for "basis points". 100 bps = 1%, 10000 bps = 100%.
 * We use bps because Solidity has no decimals, only whole numbers.
 */
contract Marketplace is ReentrancyGuard, Ownable {

    // ------------------------------------------------------------
    //  CONSTANTS
    // ------------------------------------------------------------

    /// 10000 basis points = 100%. Used as the divisor in fee math.
    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// Sanity cap so combined fees can never exceed 10%.
    uint16  private constant MAX_TOTAL_FEE_BPS = 1000;

    // ------------------------------------------------------------
    //  TYPES
    // ------------------------------------------------------------

    /// Everything we need to know about one listing.
    struct Listing {
        address seller;         // who put it up for sale
        address token;          // which ChannelToken contract
        address creator;        // who receives the royalty
        uint256 amount;         // tokens still available
        uint256 pricePerToken;  // MATIC (in wei) per 1 whole token
        bool    active;         // false once cancelled or sold out
    }

    // ------------------------------------------------------------
    //  STORAGE
    // ------------------------------------------------------------

    uint16  public royaltyBps;       // e.g. 200 = 2% to the creator
    uint16  public platformFeeBps;   // e.g. 100 = 1% to the platform
    uint256 public nextListingId;    // auto-incremented id for each listing

    mapping(uint256 => Listing) public listings;

    // ------------------------------------------------------------
    //  EVENTS
    // ------------------------------------------------------------

    event Listed(
        uint256 indexed id,
        address indexed seller,
        address indexed token,
        uint256 amount,
        uint256 pricePerToken
    );

    event Cancelled(uint256 indexed id);

    event Purchased(
        uint256 indexed id,
        address indexed buyer,
        uint256 amount,
        uint256 totalPaid,
        uint256 royaltyPaid,
        uint256 platformFeePaid
    );

    // ------------------------------------------------------------
    //  CONSTRUCTOR
    // ------------------------------------------------------------

    constructor(uint16 royaltyBps_, uint16 platformFeeBps_) Ownable(msg.sender) {
        _setFees(royaltyBps_, platformFeeBps_);
    }

    // ------------------------------------------------------------
    //  ADMIN
    // ------------------------------------------------------------

    /// Allows the platform owner to update the royalty / fee rates later.
    function setFees(uint16 royaltyBps_, uint16 platformFeeBps_) external onlyOwner {
        _setFees(royaltyBps_, platformFeeBps_);
    }

    /// Internal helper used by both the constructor and `setFees`.
    function _setFees(uint16 royaltyBps_, uint16 platformFeeBps_) internal {
        require(royaltyBps_ + platformFeeBps_ <= MAX_TOTAL_FEE_BPS, "fees > 10%");
        royaltyBps     = royaltyBps_;
        platformFeeBps = platformFeeBps_;
    }

    // ------------------------------------------------------------
    //  LIST  —  put tokens up for sale
    // ------------------------------------------------------------

    /**
     * The seller MUST call `approve(marketplace, amount)` on the token
     * BEFORE calling this. Otherwise the `transferFrom` below will fail.
     */
    function listForSale(
        address token,
        address creator,
        uint256 amount,
        uint256 pricePerToken
    )
        external
        returns (uint256 id)
    {
        require(amount > 0 && pricePerToken > 0, "bad args");
        require(creator != address(0),           "creator = 0");

        // Pull the tokens from the seller into this contract (escrow).
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Save the listing under a fresh id.
        id = ++nextListingId;
        listings[id] = Listing({
            seller:        msg.sender,
            token:         token,
            creator:       creator,
            amount:        amount,
            pricePerToken: pricePerToken,
            active:        true
        });

        emit Listed(id, msg.sender, token, amount, pricePerToken);
    }

    // ------------------------------------------------------------
    //  CANCEL  —  seller pulls the listing and gets tokens back
    // ------------------------------------------------------------

    function cancel(uint256 id) external nonReentrant {
        Listing storage l = listings[id];
        require(l.active,                "inactive");
        require(l.seller == msg.sender,  "not seller");

        l.active = false;
        IERC20(l.token).transfer(l.seller, l.amount);

        emit Cancelled(id);
    }

    // ------------------------------------------------------------
    //  BUY  —  the main flow, broken into clear steps
    // ------------------------------------------------------------

    /**
     * Buy `amount` tokens from listing `id`.
     *
     * `msg.value` (the MATIC sent with the call) must equal:
     *      amount * pricePerToken / 1e18
     */
    function buy(uint256 id, uint256 amount) external payable nonReentrant {
        Listing storage l = listings[id];

        // ---- 1) validate ----
        require(l.active,                          "inactive");
        require(amount > 0 && amount <= l.amount,  "bad amount");

        // ---- 2) calculate the three payment slices ----
        uint256 total          = (amount * l.pricePerToken) / 1e18;
        require(msg.value == total, "wrong payment");

        (uint256 royalty, uint256 fee, uint256 sellerProceeds) = _split(total);

        // ---- 3) update state BEFORE we touch the outside world
        //         (checks-effects-interactions pattern) ----
        l.amount -= amount;
        if (l.amount == 0) {
            l.active = false;
        }

        // ---- 4) hand the tokens to the buyer ----
        IERC20(l.token).transfer(msg.sender, amount);

        // ---- 5) pay creator, platform, then seller ----
        _send(l.creator, royalty,        "royalty fail");
        _send(owner(),   fee,            "fee fail");
        _send(l.seller,  sellerProceeds, "seller pay fail");

        // ---- 6) announce ----
        emit Purchased(id, msg.sender, amount, total, royalty, fee);
    }

    // ------------------------------------------------------------
    //  INTERNAL HELPERS
    // ------------------------------------------------------------

    /// Computes royalty, platform fee and what's left for the seller.
    function _split(uint256 total)
        internal
        view
        returns (uint256 royalty, uint256 fee, uint256 sellerProceeds)
    {
        royalty        = (total * royaltyBps)     / BPS_DENOMINATOR;
        fee            = (total * platformFeeBps) / BPS_DENOMINATOR;
        sellerProceeds = total - royalty - fee;
    }

    /// Safely sends MATIC. Skips the call when the amount is zero.
    function _send(address to, uint256 amount, string memory errMsg) internal {
        if (amount == 0) return;
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, errMsg);
    }
}
