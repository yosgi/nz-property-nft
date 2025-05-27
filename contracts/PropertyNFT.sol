// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract PropertyNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Property structure
    struct Property {
        string propertyAddress;
        string ownerName;
        string propertyType;
        uint256 renovationDate;
        uint256 submissionDate;
        uint256 estimatedValue;
        bool isVerified;
        uint256 verificationVotes;
        uint256 rejectionVotes;
        mapping(address => bool) hasVoted;
    }
    
    // Mappings
    mapping(uint256 => Property) public properties;
    mapping(string => bool) public addressExists;
    mapping(address => uint256[]) public ownerProperties;
    
    // Events
    event PropertySubmitted(
        uint256 indexed tokenId,
        string propertyAddress,
        string ownerName,
        address indexed submitter
    );
    
    event PropertyVerified(uint256 indexed tokenId, bool verified);
    event VoteCast(uint256 indexed tokenId, address indexed voter, bool approve);
    event PropertyValueUpdated(uint256 indexed tokenId, uint256 newValue);
    
    // Constants
    uint256 public constant VERIFICATION_THRESHOLD = 10;
    uint256 public constant REJECTION_THRESHOLD = 5;
    
    constructor() ERC721("PropertyNFT", "PROP") {}
    
    /**
     * @dev Submit a new property for NFT creation
     */
    function submitProperty(
        string memory _propertyAddress,
        string memory _ownerName,
        string memory _propertyType,
        uint256 _renovationDate,
        string memory _tokenURI
    ) public returns (uint256) {
        require(bytes(_propertyAddress).length > 0, "Property address cannot be empty");
        require(bytes(_ownerName).length > 0, "Owner name cannot be empty");
        require(!addressExists[_propertyAddress], "Property already exists");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        // Mint NFT to the submitter
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        
        // Create property record
        Property storage newProperty = properties[tokenId];
        newProperty.propertyAddress = _propertyAddress;
        newProperty.ownerName = _ownerName;
        newProperty.propertyType = _propertyType;
        newProperty.renovationDate = _renovationDate;
        newProperty.submissionDate = block.timestamp;
        newProperty.estimatedValue = 0;
        newProperty.isVerified = false;
        newProperty.verificationVotes = 0;
        newProperty.rejectionVotes = 0;
        
        // Mark address as existing
        addressExists[_propertyAddress] = true;
        
        // Add to owner's properties
        ownerProperties[msg.sender].push(tokenId);
        
        emit PropertySubmitted(tokenId, _propertyAddress, _ownerName, msg.sender);
        
        return tokenId;
    }
    
    /**
     * @dev Vote on property verification
     */
    function voteOnProperty(uint256 _tokenId, bool _approve) public {
        require(_exists(_tokenId), "Property does not exist");
        require(!properties[_tokenId].isVerified, "Property already verified");
        require(!properties[_tokenId].hasVoted[msg.sender], "Already voted");
        require(ownerOf(_tokenId) != msg.sender, "Cannot vote on own property");
        
        Property storage property = properties[_tokenId];
        property.hasVoted[msg.sender] = true;
        
        if (_approve) {
            property.verificationVotes++;
        } else {
            property.rejectionVotes++;
        }
        
        emit VoteCast(_tokenId, msg.sender, _approve);
        
        // Check if verification threshold is met
        if (property.verificationVotes >= VERIFICATION_THRESHOLD) {
            property.isVerified = true;
            emit PropertyVerified(_tokenId, true);
        } else if (property.rejectionVotes >= REJECTION_THRESHOLD) {
            // Property rejected - could implement rejection logic here
            emit PropertyVerified(_tokenId, false);
        }
    }
    
    /**
     * @dev Update property estimated value (only owner)
     */
    function updatePropertyValue(uint256 _tokenId, uint256 _newValue) public {
        require(_exists(_tokenId), "Property does not exist");
        require(ownerOf(_tokenId) == msg.sender || owner() == msg.sender, "Not authorized");
        
        properties[_tokenId].estimatedValue = _newValue;
        emit PropertyValueUpdated(_tokenId, _newValue);
    }
    
    /**
     * @dev Get property details
     */
    function getProperty(uint256 _tokenId) public view returns (
        string memory propertyAddress,
        string memory ownerName,
        string memory propertyType,
        uint256 renovationDate,
        uint256 submissionDate,
        uint256 estimatedValue,
        bool isVerified,
        uint256 verificationVotes,
        uint256 rejectionVotes
    ) {
        require(_exists(_tokenId), "Property does not exist");
        
        Property storage property = properties[_tokenId];
        return (
            property.propertyAddress,
            property.ownerName,
            property.propertyType,
            property.renovationDate,
            property.submissionDate,
            property.estimatedValue,
            property.isVerified,
            property.verificationVotes,
            property.rejectionVotes
        );
    }
    
    /**
     * @dev Get properties owned by an address
     */
    function getOwnerProperties(address _owner) public view returns (uint256[] memory) {
        return ownerProperties[_owner];
    }
    
    /**
     * @dev Check if user has voted on a property
     */
    function hasUserVoted(uint256 _tokenId, address _user) public view returns (bool) {
        require(_exists(_tokenId), "Property does not exist");
        return properties[_tokenId].hasVoted[_user];
    }
    
    /**
     * @dev Get total number of properties
     */
    function getTotalProperties() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Get all unverified properties for verification
     */
    function getUnverifiedProperties() public view returns (uint256[] memory) {
        uint256 totalProperties = _tokenIdCounter.current();
        uint256[] memory tempArray = new uint256[](totalProperties);
        uint256 count = 0;
        
        for (uint256 i = 0; i < totalProperties; i++) {
            if (!properties[i].isVerified && 
                properties[i].rejectionVotes < REJECTION_THRESHOLD) {
                tempArray[count] = i;
                count++;
            }
        }
        
        // Create array with exact size
        uint256[] memory unverifiedProperties = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            unverifiedProperties[i] = tempArray[i];
        }
        
        return unverifiedProperties;
    }
    
    /**
     * @dev Transfer property ownership (override to update ownerProperties)
     */
    function transferFrom(address from, address to, uint256 tokenId) public override(ERC721, IERC721) {
        super.transferFrom(from, to, tokenId);
        
        // Remove from previous owner's list
        uint256[] storage fromProperties = ownerProperties[from];
        for (uint256 i = 0; i < fromProperties.length; i++) {
            if (fromProperties[i] == tokenId) {
                fromProperties[i] = fromProperties[fromProperties.length - 1];
                fromProperties.pop();
                break;
            }
        }
        
        // Add to new owner's list
        ownerProperties[to].push(tokenId);
    }
    
    /**
     * @dev Safe transfer with ownership tracking
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override(ERC721, IERC721) {
        super.safeTransferFrom(from, to, tokenId, data);
        
        // Remove from previous owner's list
        uint256[] storage fromProperties = ownerProperties[from];
        for (uint256 i = 0; i < fromProperties.length; i++) {
            if (fromProperties[i] == tokenId) {
                fromProperties[i] = fromProperties[fromProperties.length - 1];
                fromProperties.pop();
                break;
            }
        }
        
        // Add to new owner's list
        ownerProperties[to].push(tokenId);
    }
    
    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
