// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Tiny interface for the badge NFT contract.
 * We only need its `mint` function from here.
 */
interface IBadge {
    function mint(address to, string memory uri) external returns (uint256);
}

/**
 * MilestoneChallenge
 * ------------------
 * A prediction game for fans. Step by step:
 *
 *   1. Creator opens a challenge — e.g. "My channel will hit 1M subs by Dec 31".
 *   2. Fans call `join(id, YES)` or `join(id, NO)` BEFORE the deadline.
 *      No money is staked. This is a prediction game, not gambling.
 *   3. After the deadline passes, the trusted oracle (our backend)
 *      reads the real subscriber count from YouTube and calls `resolve(...)`.
 *   4. Fans whose prediction matches reality call `claimBadge(id)` and
 *      receive an NFT badge in their wallet.
 */
contract MilestoneChallenge is Ownable, ReentrancyGuard {

    // ------------------------------------------------------------
    //  TYPES
    // ------------------------------------------------------------

    /// Three possible states for a prediction or a challenge outcome.
    enum Outcome {
        Pending,   // not yet decided / not yet predicted
        Yes,       // target was reached
        No         // target was not reached
    }

    struct Challenge {
        address creator;
        string  channelId;   // e.g. "UCxxxxxxxx"
        string  metric;      // e.g. "subscribers"
        uint256 target;      // e.g. 1_000_000
        uint64  deadline;    // unix seconds
        Outcome outcome;     // set when resolved
        string  badgeUri;    // IPFS URI for the winner badge artwork
        bool    resolved;
    }

    // ------------------------------------------------------------
    //  STORAGE
    // ------------------------------------------------------------

    address public oracle;            // backend wallet allowed to resolve
    IBadge  public badge;             // ChannelBadgeNFT
    uint256 public nextChallengeId;

    mapping(uint256 => Challenge) public challenges;

    /// challengeId => fan => their prediction (Yes / No / Pending)
    mapping(uint256 => mapping(address => Outcome)) public predictions;

    /// challengeId => fan => has already claimed their badge?
    mapping(uint256 => mapping(address => bool)) public claimed;

    // ------------------------------------------------------------
    //  EVENTS
    // ------------------------------------------------------------

    event ChallengeCreated(
        uint256 indexed id,
        address indexed creator,
        string channelId,
        string metric,
        uint256 target,
        uint64 deadline
    );

    event Joined(uint256 indexed id, address indexed user, Outcome prediction);
    event Resolved(uint256 indexed id, Outcome outcome, uint256 actual);
    event BadgeClaimed(uint256 indexed id, address indexed user, uint256 badgeId);

    // ------------------------------------------------------------
    //  CONSTRUCTOR
    // ------------------------------------------------------------

    constructor(address oracle_, address badge_) Ownable(msg.sender) {
        require(oracle_ != address(0), "oracle = 0");
        require(badge_  != address(0), "badge  = 0");
        oracle = oracle_;
        badge  = IBadge(badge_);
    }

    // ------------------------------------------------------------
    //  MODIFIERS
    // ------------------------------------------------------------

    /// Only the trusted backend oracle wallet may call functions marked with this.
    modifier onlyOracle() {
        require(msg.sender == oracle, "not oracle");
        _;
    }

    // ------------------------------------------------------------
    //  ADMIN
    // ------------------------------------------------------------

    /// Lets the platform owner rotate the oracle wallet if needed.
    function setOracle(address o) external onlyOwner {
        require(o != address(0), "oracle = 0");
        oracle = o;
    }

    // ------------------------------------------------------------
    //  STEP 1 — creator opens a challenge
    // ------------------------------------------------------------

    function createChallenge(
        string calldata channelId,
        string calldata metric,
        uint256 target,
        uint64 deadline,
        string calldata badgeUri
    )
        external
        returns (uint256 id)
    {
        require(deadline > block.timestamp, "deadline must be in the future");

        id = ++nextChallengeId;
        challenges[id] = Challenge({
            creator:   msg.sender,
            channelId: channelId,
            metric:    metric,
            target:    target,
            deadline:  deadline,
            outcome:   Outcome.Pending,
            badgeUri:  badgeUri,
            resolved:  false
        });

        emit ChallengeCreated(id, msg.sender, channelId, metric, target, deadline);
    }

    // ------------------------------------------------------------
    //  STEP 2 — fans submit YES / NO predictions before the deadline
    // ------------------------------------------------------------

    function join(uint256 id, Outcome prediction) external {
        Challenge storage c = challenges[id];

        // Basic checks before recording the prediction.
        require(c.creator != address(0),                                  "no such challenge");
        require(block.timestamp < c.deadline,                             "predictions closed");
        require(prediction == Outcome.Yes || prediction == Outcome.No,    "must be YES or NO");
        require(predictions[id][msg.sender] == Outcome.Pending,           "already joined");

        predictions[id][msg.sender] = prediction;
        emit Joined(id, msg.sender, prediction);
    }

    // ------------------------------------------------------------
    //  STEP 3 — oracle resolves the challenge after the deadline
    // ------------------------------------------------------------

    /// `actualValue` is the real metric (e.g. real subscriber count).
    /// If it >= target, outcome is YES; otherwise outcome is NO.
    function resolve(uint256 id, uint256 actualValue) external onlyOracle {
        Challenge storage c = challenges[id];

        require(!c.resolved,                      "already resolved");
        require(block.timestamp >= c.deadline,    "too early");

        c.resolved = true;
        c.outcome  = (actualValue >= c.target) ? Outcome.Yes : Outcome.No;

        emit Resolved(id, c.outcome, actualValue);
    }

    // ------------------------------------------------------------
    //  STEP 4 — winning fans pull their NFT badge
    // ------------------------------------------------------------

    function claimBadge(uint256 id) external nonReentrant {
        Challenge storage c = challenges[id];
        Outcome pred        = predictions[id][msg.sender];

        require(c.resolved,                  "not resolved yet");
        require(pred != Outcome.Pending,     "you didn't predict");
        require(pred == c.outcome,           "your prediction was wrong");
        require(!claimed[id][msg.sender],    "already claimed");

        // Mark first so a re-entrant attacker can't claim twice.
        claimed[id][msg.sender] = true;

        uint256 badgeId = badge.mint(msg.sender, c.badgeUri);
        emit BadgeClaimed(id, msg.sender, badgeId);
    }
}
