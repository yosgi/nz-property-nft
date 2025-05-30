// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract PropertyNFT is ERC721, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using Strings for uint256;

    Counters.Counter private _tokenIdCounter;
    struct PropertySummary {
        uint256 tokenId;
        string propertyAddress;
        string ownerName;
        string propertyType;
        uint256 renovationDate;
        string imageURI;
        int256 latitude;
        int256 longitude;
        bool isVerified;
        uint256 estimatedValue;
        uint256 verificationVotes;
        uint256 rejectionVotes;
        address currentOwner;
    }

    // 🆕 Statistics struct
    struct ContractStats {
        uint256 totalProperties;
        uint256 verifiedProperties;
        uint256 unverifiedProperties;
        uint256 rejectedProperties;
        uint256 totalEstimatedValue;
        uint256 averagePropertyValue;
    }

    // 🆕 Additional mappings for enhanced queries
    mapping(string => uint256[]) public propertiesByType;
    mapping(uint256 => uint256[]) public propertiesByYearRange; // year => tokenIds

    // Property structure
    struct Property {
        string propertyAddress;
        string ownerName;
        string propertyType;
        uint256 renovationDate;
        string imageURI;
        int256 latitude;
        int256 longitude;
        bool isVerified;
        uint256 estimatedValue;
        uint256 verificationVotes;
        uint256 rejectionVotes;
        // Valuation scores
        uint256 locationScore;
        uint256 sizeScore;
        uint256 conditionScore;
        uint256 ageScore;
        uint256 renovationScore;
        uint256 comparableValue;
        uint256 lastValuationUpdate;
        mapping(address => bool) hasVoted;
    }

    // Mappings
    mapping(uint256 => Property) public properties;
    mapping(string => bool) public addressExists;
    mapping(address => uint256[]) public ownerProperties;

    // Authorization mapping for contracts that can update property values
    mapping(address => bool) public authorizedContracts;

    // Events
    event PropertySubmitted(
        uint256 indexed tokenId,
        string propertyAddress,
        string ownerName,
        address indexed submitter
    );

    event PropertyVerified(uint256 indexed tokenId, bool verified);
    event VoteCast(
        uint256 indexed tokenId,
        address indexed voter,
        bool approve
    );
    event PropertyValueUpdated(uint256 indexed tokenId, uint256 newValue);

    // Authorization events
    event ContractAuthorized(address indexed contractAddress, bool authorized);

    // EIP-4906: Metadata Update Event
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    // Constants
    uint256 public constant VERIFICATION_THRESHOLD = 3;
    uint256 public constant REJECTION_THRESHOLD = 2;

    constructor() ERC721("PropertyNFT", "PROP") {}

    // Modifier for authorized value updates
    modifier onlyAuthorizedForValue(uint256 _tokenId) {
        require(
            ownerOf(_tokenId) == msg.sender ||
                owner() == msg.sender ||
                authorizedContracts[msg.sender],
            "Not authorized to update value"
        );
        _;
    }

    /**
     * @dev Authorize or deauthorize a contract to update property values
     * @param _contract Address of the contract to authorize/deauthorize
     * @param _authorized True to authorize, false to deauthorize
     */
    function setAuthorizedContract(
        address _contract,
        bool _authorized
    ) public onlyOwner {
        require(_contract != address(0), "Invalid contract address");
        authorizedContracts[_contract] = _authorized;
        emit ContractAuthorized(_contract, _authorized);
    }

    /**
     * @dev Check if a contract is authorized to update property values
     * @param _contract Address to check
     * @return bool True if authorized
     */
    function isAuthorizedContract(
        address _contract
    ) public view returns (bool) {
        return authorizedContracts[_contract];
    }

    /**
     * @dev Submit a new property for NFT creation
     */
    function submitProperty(
        string memory _propertyAddress,
        string memory _ownerName,
        string memory _propertyType,
        uint256 _renovationDate,
        string memory _imageURI,
        int256 _latitude,
        int256 _longitude
    ) public returns (uint256) {
        require(
            bytes(_propertyAddress).length > 0,
            "Property address cannot be empty"
        );
        require(bytes(_ownerName).length > 0, "Owner name cannot be empty");
        require(!addressExists[_propertyAddress], "Property already exists");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        // Mint NFT to the submitter
        _safeMint(msg.sender, tokenId);

        // Create property record
        Property storage newProperty = properties[tokenId];
        newProperty.propertyAddress = _propertyAddress;
        newProperty.ownerName = _ownerName;
        newProperty.propertyType = _propertyType;
        newProperty.renovationDate = _renovationDate;
        newProperty.imageURI = _imageURI;
        newProperty.latitude = _latitude;
        newProperty.longitude = _longitude;
        newProperty.isVerified = false;
        newProperty.estimatedValue = 0;
        newProperty.verificationVotes = 0;
        newProperty.rejectionVotes = 0;
        // Initialize valuation scores to 0
        newProperty.locationScore = 0;
        newProperty.sizeScore = 0;
        newProperty.conditionScore = 0;
        newProperty.ageScore = 0;
        newProperty.renovationScore = 0;
        newProperty.comparableValue = 0;
        newProperty.lastValuationUpdate = 0;

        // Mark address as existing
        addressExists[_propertyAddress] = true;

        // Add to owner's properties
        ownerProperties[msg.sender].push(tokenId);
        propertiesByType[_propertyType].push(tokenId);
        emit PropertySubmitted(
            tokenId,
            _propertyAddress,
            _ownerName,
            msg.sender
        );
        emit MetadataUpdate(tokenId);
        if (_renovationDate > 0) {
            uint256 year = _renovationDate / 31536000 + 1970; // Convert timestamp to year
            propertiesByYearRange[year].push(tokenId);
        }
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
            emit VoteCast(_tokenId, msg.sender, true);

            // Check if verification threshold is met
            if (property.verificationVotes >= VERIFICATION_THRESHOLD) {
                property.isVerified = true;
                emit PropertyVerified(_tokenId, true);
                emit MetadataUpdate(_tokenId); // Update metadata when verification status changes
            }
        } else {
            property.rejectionVotes++;
            emit VoteCast(_tokenId, msg.sender, false);

            // Check if rejection threshold is met
            if (property.rejectionVotes >= REJECTION_THRESHOLD) {
                emit PropertyVerified(_tokenId, false);
                emit MetadataUpdate(_tokenId); // Update metadata when verification status changes
            }
        }
    }

    /**
     * @dev Update property estimated value (updated authorization logic)
     * @param _tokenId Token ID of the property
     * @param _newValue New estimated value
     */
    function updatePropertyValue(
        uint256 _tokenId,
        uint256 _newValue
    ) public onlyAuthorizedForValue(_tokenId) {
        require(_exists(_tokenId), "Property does not exist");

        properties[_tokenId].estimatedValue = _newValue;
        properties[_tokenId].lastValuationUpdate = block.timestamp;
        emit PropertyValueUpdated(_tokenId, _newValue);
        emit MetadataUpdate(_tokenId); // Update metadata when value changes
    }

    /**
     * @dev Update property valuation scores (called by authorized contracts)
     * @param _tokenId Token ID of the property
     * @param _estimatedValue New estimated value
     * @param _comparableValue Comparable market value
     * @param _locationScore Location score (0-100)
     * @param _sizeScore Size score (0-100)
     * @param _conditionScore Condition score (0-100)
     * @param _ageScore Age score (0-100)
     * @param _renovationScore Renovation score (0-100)
     */
    function updatePropertyValuation(
        uint256 _tokenId,
        uint256 _estimatedValue,
        uint256 _comparableValue,
        uint256 _locationScore,
        uint256 _sizeScore,
        uint256 _conditionScore,
        uint256 _ageScore,
        uint256 _renovationScore
    ) public onlyAuthorizedForValue(_tokenId) {
        require(_exists(_tokenId), "Property does not exist");
        require(_locationScore <= 100, "Location score must be <= 100");
        require(_sizeScore <= 100, "Size score must be <= 100");
        require(_conditionScore <= 100, "Condition score must be <= 100");
        require(_ageScore <= 100, "Age score must be <= 100");
        require(_renovationScore <= 100, "Renovation score must be <= 100");

        Property storage property = properties[_tokenId];
        property.estimatedValue = _estimatedValue;
        property.comparableValue = _comparableValue;
        property.locationScore = _locationScore;
        property.sizeScore = _sizeScore;
        property.conditionScore = _conditionScore;
        property.ageScore = _ageScore;
        property.renovationScore = _renovationScore;
        property.lastValuationUpdate = block.timestamp;

        emit PropertyValueUpdated(_tokenId, _estimatedValue);
        emit MetadataUpdate(_tokenId);
    }

    /**
     * @dev Generate dynamic metadata for the token
     * @param tokenId Token ID to generate metadata for
     * @return string Base64 encoded JSON metadata
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_exists(tokenId), "Property does not exist");

        Property storage property = properties[tokenId];

        // Calculate overall score (average of all scores)
        uint256 overallScore = 0;
        uint256 scoreCount = 0;

        if (property.locationScore > 0) {
            overallScore += property.locationScore;
            scoreCount++;
        }
        if (property.sizeScore > 0) {
            overallScore += property.sizeScore;
            scoreCount++;
        }
        if (property.conditionScore > 0) {
            overallScore += property.conditionScore;
            scoreCount++;
        }
        if (property.ageScore > 0) {
            overallScore += property.ageScore;
            scoreCount++;
        }
        if (property.renovationScore > 0) {
            overallScore += property.renovationScore;
            scoreCount++;
        }

        if (scoreCount > 0) {
            overallScore = overallScore / scoreCount;
        }

        // Build JSON metadata
        string memory json = string(
            abi.encodePacked(
                '{"name": "Property #',
                tokenId.toString(),
                " - ",
                property.propertyAddress,
                '", "description": "Verified property NFT representing real estate at ',
                property.propertyAddress,
                ". Owner: ",
                property.ownerName,
                '", "image": "',
                property.imageURI,
                '", "external_url": "https://yourapp.com/property/',
                tokenId.toString(),
                '", "attributes": [',
                _buildAttributes(tokenId, property, overallScore),
                "]}"
            )
        );

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(bytes(json))
                )
            );
    }

    /**
     * @dev Build attributes array for metadata
     * @param tokenId Token ID
     * @param property Property struct
     * @param overallScore Calculated overall score
     * @return string JSON attributes array
     */
    function _buildAttributes(
        uint256 tokenId,
        Property storage property,
        uint256 overallScore
    ) internal view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    '{"trait_type": "Property Type", "value": "',
                    property.propertyType,
                    '"},',
                    '{"trait_type": "Owner", "value": "',
                    property.ownerName,
                    '"},',
                    '{"trait_type": "Verification Status", "value": "',
                    property.isVerified ? "Verified" : "Pending",
                    '"},',
                    '{"trait_type": "Estimated Value", "display_type": "number", "value": ',
                    property.estimatedValue.toString(),
                    "},",
                    property.comparableValue > 0
                        ? string(
                            abi.encodePacked(
                                '{"trait_type": "Comparable Value", "display_type": "number", "value": ',
                                property.comparableValue.toString(),
                                "},"
                            )
                        )
                        : "",
                    _buildScoreAttributes(property),
                    overallScore > 0
                        ? string(
                            abi.encodePacked(
                                '{"trait_type": "Overall Score", "display_type": "boost_percentage", "value": ',
                                overallScore.toString(),
                                "},"
                            )
                        )
                        : "",
                    '{"trait_type": "Latitude", "display_type": "number", "value": ',
                    _int256ToString(property.latitude),
                    "},",
                    '{"trait_type": "Longitude", "display_type": "number", "value": ',
                    _int256ToString(property.longitude),
                    "},",
                    '{"trait_type": "Renovation Date", "display_type": "date", "value": ',
                    property.renovationDate.toString(),
                    "},",
                    '{"trait_type": "Verification Votes", "display_type": "number", "value": ',
                    property.verificationVotes.toString(),
                    "},",
                    '{"trait_type": "Rejection Votes", "display_type": "number", "value": ',
                    property.rejectionVotes.toString(),
                    "}"
                )
            );
    }

    /**
     * @dev Build score attributes for metadata
     * @param property Property struct
     * @return string JSON score attributes
     */
    function _buildScoreAttributes(
        Property storage property
    ) internal view returns (string memory) {
        string memory scores = "";

        if (property.locationScore > 0) {
            scores = string(
                abi.encodePacked(
                    scores,
                    '{"trait_type": "Location Score", "display_type": "boost_percentage", "value": ',
                    property.locationScore.toString(),
                    "},"
                )
            );
        }

        if (property.sizeScore > 0) {
            scores = string(
                abi.encodePacked(
                    scores,
                    '{"trait_type": "Size Score", "display_type": "boost_percentage", "value": ',
                    property.sizeScore.toString(),
                    "},"
                )
            );
        }

        if (property.conditionScore > 0) {
            scores = string(
                abi.encodePacked(
                    scores,
                    '{"trait_type": "Condition Score", "display_type": "boost_percentage", "value": ',
                    property.conditionScore.toString(),
                    "},"
                )
            );
        }

        if (property.ageScore > 0) {
            scores = string(
                abi.encodePacked(
                    scores,
                    '{"trait_type": "Age Score", "display_type": "boost_percentage", "value": ',
                    property.ageScore.toString(),
                    "},"
                )
            );
        }

        if (property.renovationScore > 0) {
            scores = string(
                abi.encodePacked(
                    scores,
                    '{"trait_type": "Renovation Score", "display_type": "boost_percentage", "value": ',
                    property.renovationScore.toString(),
                    "},"
                )
            );
        }

        return scores;
    }

    /**
     * @dev Convert int256 to string
     * @param value The integer value to convert
     * @return string representation of the integer
     */
    function _int256ToString(
        int256 value
    ) internal pure returns (string memory) {
        if (value >= 0) {
            return uint256(value).toString();
        } else {
            return string(abi.encodePacked("-", uint256(-value).toString()));
        }
    }
    /**
     * 🆕 @dev Get multiple properties in a single call
     * @param _tokenIds Array of token IDs to query
     * @return PropertySummary[] Array of property summaries
     */
    function getMultipleProperties(
        uint256[] memory _tokenIds
    ) public view returns (PropertySummary[] memory) {
        PropertySummary[] memory propertySummaries = new PropertySummary[](
            _tokenIds.length
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            if (_exists(tokenId)) {
                Property storage prop = properties[tokenId];
                propertySummaries[i] = PropertySummary({
                    tokenId: tokenId,
                    propertyAddress: prop.propertyAddress,
                    ownerName: prop.ownerName,
                    propertyType: prop.propertyType,
                    renovationDate: prop.renovationDate,
                    imageURI: prop.imageURI,
                    latitude: prop.latitude,
                    longitude: prop.longitude,
                    isVerified: prop.isVerified,
                    estimatedValue: prop.estimatedValue,
                    verificationVotes: prop.verificationVotes,
                    rejectionVotes: prop.rejectionVotes,
                    currentOwner: ownerOf(tokenId)
                });
            }
        }

        return propertySummaries;
    }

    /**
     * 🆕 @dev Get properties by type (e.g., "apartment", "house", "commercial")
     * @param _propertyType Type of property to filter by
     * @return uint256[] Array of token IDs matching the type
     */
    function getPropertiesByType(
        string memory _propertyType
    ) public view returns (uint256[] memory) {
        return propertiesByType[_propertyType];
    }

    /**
     * 🆕 @dev Get properties by owner with detailed information
     * @param _owner Address of the owner
     * @return PropertySummary[] Array of property summaries owned by the address
     */
    function getOwnerPropertiesDetailed(
        address _owner
    ) public view returns (PropertySummary[] memory) {
        uint256[] memory tokenIds = ownerProperties[_owner];
        return getMultipleProperties(tokenIds);
    }
}
