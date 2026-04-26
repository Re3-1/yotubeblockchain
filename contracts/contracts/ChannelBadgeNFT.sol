// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ERC-721 (the NFT standard) plus a helper that lets each token have its
// own URI (a link to its artwork / metadata, usually on IPFS).
import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

// AccessControl gives us role-based permissions, which is more flexible
// than Ownable when more than one address needs to act as admin or minter.
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * ChannelBadgeNFT
 * ---------------
 * A simple ERC-721 contract that mints "badge" NFTs to fans who win a
 * MilestoneChallenge.
 *
 * Two roles exist:
 *   - DEFAULT_ADMIN_ROLE  — can grant the MINTER_ROLE to other addresses.
 *   - MINTER_ROLE         — can call `mint`. We give this role to the
 *                           MilestoneChallenge contract at deployment time
 *                           so only it can create badges.
 */
contract ChannelBadgeNFT is ERC721URIStorage, AccessControl {

    // ------------------------------------------------------------
    //  ROLES
    // ------------------------------------------------------------

    /// Anyone who holds this role can mint new badges.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ------------------------------------------------------------
    //  STORAGE
    // ------------------------------------------------------------

    /// Auto-incremented id used for each new badge.
    uint256 public nextId;

    // ------------------------------------------------------------
    //  CONSTRUCTOR
    // ------------------------------------------------------------

    constructor() ERC721("Channel Badge", "CBDG") {
        // The deployer starts as both admin and minter so they can
        // bootstrap things (e.g. grant MINTER_ROLE to MilestoneChallenge).
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE,        msg.sender);
    }

    // ------------------------------------------------------------
    //  ADMIN  —  give MINTER_ROLE to another address
    // ------------------------------------------------------------

    function grantMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, minter);
    }

    // ------------------------------------------------------------
    //  MINT  —  only callable by addresses holding MINTER_ROLE
    // ------------------------------------------------------------

    function mint(address to, string memory uri)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 id)
    {
        id = ++nextId;
        _safeMint(to, id);       // creates the NFT and gives it to `to`
        _setTokenURI(id, uri);   // links it to its artwork on IPFS
    }

    // ------------------------------------------------------------
    //  ERC-165  —  required because we inherit from two parents
    //              that each implement supportsInterface.
    // ------------------------------------------------------------

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
