// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PropertyNFT.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PropertyValuation is Ownable {
    PropertyNFT public propertyNFT;
    
    struct ValuationData {
        uint256 estimatedValue;
        uint256 comparableValue;
        uint256 lastUpdated;
        uint256 locationScore;
        uint256 sizeScore;
        uint256 conditionScore;
        uint256 ageScore;
        uint256 renovationScore;
        bool isVerified;
        uint256 verificationVotes;
        uint256 rejectionVotes;
        mapping(address => bool) hasVoted;
    }
    
    mapping(uint256 => ValuationData) public valuations;
    mapping(uint256 => uint256[]) public historicalValues;
    
    struct Valuation {
        uint256 estimatedValue;
        uint256 comparableValue;
        uint256 lastUpdated;
        uint256 locationScore;
        uint256 sizeScore;
        uint256 conditionScore;
        uint256 ageScore;
        uint256 renovationScore;
        bool isVerified;
        uint256 verificationVotes;
        uint256 rejectionVotes;
    }

    mapping(uint256 => Valuation) public pendingValuations;
    mapping(uint256 => mapping(address => bool)) public pendingValuationVotes;
    
    event ValuationUpdated(uint256 indexed tokenId, uint256 estimatedValue, uint256 comparableValue);
    event ValuationSubmitted(uint256 indexed tokenId, uint256 estimatedValue, uint256 comparableValue);
    event ValuationVerified(uint256 indexed tokenId, bool verified);
    event ValuationVoteCast(uint256 indexed tokenId, address indexed voter, bool approve);
    event AuthorizationRequested(address indexed valuationContract, address indexed nftContract);
    
    // Constants
    uint256 public constant VERIFICATION_THRESHOLD = 3;
    uint256 public constant REJECTION_THRESHOLD = 2;
    
    constructor(address _propertyNFTAddress) {
        require(_propertyNFTAddress != address(0), "Invalid NFT contract address");
        propertyNFT = PropertyNFT(_propertyNFTAddress);
    }
    
    /**
     * @dev Check if this contract is authorized to update PropertyNFT values
     * @return bool True if authorized
     */
    function isAuthorizedToUpdate() public view returns (bool) {
        return propertyNFT.isAuthorizedContract(address(this));
    }
    
    /**
     * @dev Get authorization status details for debugging
     * @return authorized Whether this contract is authorized
     * @return nftContract Address of the PropertyNFT contract
     * @return thisContract Address of this contract
     */
    function checkAuthorizationStatus() public view returns (
        bool authorized, 
        address nftContract, 
        address thisContract
    ) {
        return (
            propertyNFT.isAuthorizedContract(address(this)),
            address(propertyNFT),
            address(this)
        );
    }
    
    /**
     * @dev Emergency function to request authorization (emits event for admin)
     */
    function requestAuthorization() public onlyOwner {
        emit AuthorizationRequested(address(this), address(propertyNFT));
    }
    
    /**
     * @dev Submit a new property valuation for verification
     */
    function submitValuation(
        uint256 _tokenId,
        uint256 _estimatedValue,
        uint256 _comparableValue,
        uint256 _locationScore,
        uint256 _sizeScore,
        uint256 _conditionScore,
        uint256 _ageScore,
        uint256 _renovationScore
    ) public {
        require(propertyNFT.ownerOf(_tokenId) != address(0), "Property does not exist");
        require(propertyNFT.ownerOf(_tokenId) == msg.sender || owner() == msg.sender, "Not authorized");
        require(_locationScore <= 100, "Location score must be <= 100");
        require(_sizeScore <= 100, "Size score must be <= 100");
        require(_conditionScore <= 100, "Condition score must be <= 100");
        require(_ageScore <= 100, "Age score must be <= 100");
        require(_renovationScore <= 100, "Renovation score must be <= 100");
        
        // Store in pendingValuations
        pendingValuations[_tokenId] = Valuation({
            estimatedValue: _estimatedValue,
            comparableValue: _comparableValue,
            lastUpdated: block.timestamp,
            locationScore: _locationScore,
            sizeScore: _sizeScore,
            conditionScore: _conditionScore,
            ageScore: _ageScore,
            renovationScore: _renovationScore,
            isVerified: false,
            verificationVotes: 0,
            rejectionVotes: 0
        });
        
        emit ValuationSubmitted(_tokenId, _estimatedValue, _comparableValue);
    }
    
    /**
     * @dev Vote on property valuation
     */
    function voteOnValuation(uint256 _tokenId, bool _approve) public {
        require(propertyNFT.ownerOf(_tokenId) != address(0), "Property does not exist");
        require(!pendingValuations[_tokenId].isVerified, "Valuation already verified");
        require(!pendingValuationVotes[_tokenId][msg.sender], "Already voted");
        require(propertyNFT.ownerOf(_tokenId) != msg.sender, "Cannot vote on own property");
        
        Valuation storage valuation = pendingValuations[_tokenId];
        pendingValuationVotes[_tokenId][msg.sender] = true;
        
        if (_approve) {
            valuation.verificationVotes++;
            emit ValuationVoteCast(_tokenId, msg.sender, true);
            
            if (valuation.verificationVotes >= VERIFICATION_THRESHOLD) {
                valuation.isVerified = true;
                emit ValuationVerified(_tokenId, true);
            }
        } else {
            valuation.rejectionVotes++;
            emit ValuationVoteCast(_tokenId, msg.sender, false);
            
            if (valuation.rejectionVotes >= REJECTION_THRESHOLD) {
                // Clear pending valuation only on rejection
                delete pendingValuations[_tokenId];
                emit ValuationVerified(_tokenId, false);
            }
        }
    }
    
    /**
     * @dev Confirm valuation update (only property owner)
     * Updated to use the new PropertyNFT updatePropertyValuation function
     */
    function confirmValuationUpdate(uint256 _tokenId) public {
        require(propertyNFT.ownerOf(_tokenId) == msg.sender, "Not property owner");
        require(pendingValuations[_tokenId].isVerified, "Valuation not verified");
        require(propertyNFT.isAuthorizedContract(address(this)), "Contract not authorized to update values");
        
        Valuation storage valuation = pendingValuations[_tokenId];
        
        // Use the new comprehensive update function that includes all scores
        try propertyNFT.updatePropertyValuation(
            _tokenId,
            valuation.estimatedValue,
            valuation.comparableValue,
            valuation.locationScore,
            valuation.sizeScore,
            valuation.conditionScore,
            valuation.ageScore,
            valuation.renovationScore
        ) {
            // Success - update our records
            _updateValuationRecords(_tokenId, valuation);
            
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Failed to update property valuation: ", reason)));
        } catch {
            revert("Failed to update property valuation: unknown error");
        }
    }
    
    /**
     * @dev Internal function to update valuation records after successful NFT update
     * @param _tokenId Token ID of the property
     * @param valuation The valuation data to record
     */
    function _updateValuationRecords(uint256 _tokenId, Valuation storage valuation) internal {
        uint256 finalValue = valuation.estimatedValue;
        uint256 finalComparable = valuation.comparableValue;
        
        // Update the valuations mapping with verified data
        ValuationData storage verifiedValuation = valuations[_tokenId];
        verifiedValuation.estimatedValue = finalValue;
        verifiedValuation.comparableValue = finalComparable;
        verifiedValuation.lastUpdated = valuation.lastUpdated;
        verifiedValuation.locationScore = valuation.locationScore;
        verifiedValuation.sizeScore = valuation.sizeScore;
        verifiedValuation.conditionScore = valuation.conditionScore;
        verifiedValuation.ageScore = valuation.ageScore;
        verifiedValuation.renovationScore = valuation.renovationScore;
        verifiedValuation.isVerified = true;
        verifiedValuation.verificationVotes = valuation.verificationVotes;
        verifiedValuation.rejectionVotes = valuation.rejectionVotes;
        
        // Add to historical values
        historicalValues[_tokenId].push(finalValue);
        
        // Clear pending valuation
        delete pendingValuations[_tokenId];
        
        emit ValuationUpdated(_tokenId, finalValue, finalComparable);
    }
    
    /**
     * @dev Get valuation data (from verified valuations)
     */
    function getValuation(uint256 _tokenId) public view returns (
        uint256 estimatedValue,
        uint256 comparableValue,
        uint256 lastUpdated,
        uint256 locationScore,
        uint256 sizeScore,
        uint256 conditionScore,
        uint256 ageScore,
        uint256 renovationScore,
        bool isVerified,
        uint256 verificationVotes,
        uint256 rejectionVotes
    ) {
        ValuationData storage valuation = valuations[_tokenId];
        return (
            valuation.estimatedValue,
            valuation.comparableValue,
            valuation.lastUpdated,
            valuation.locationScore,
            valuation.sizeScore,
            valuation.conditionScore,
            valuation.ageScore,
            valuation.renovationScore,
            valuation.isVerified,
            valuation.verificationVotes,
            valuation.rejectionVotes
        );
    }
    
    /**
     * @dev Get historical values
     */
    function getHistoricalValues(uint256 _tokenId) public view returns (uint256[] memory) {
        return historicalValues[_tokenId];
    }
    
    /**
     * @dev Check if user has voted on a valuation (for verified valuations)
     */
    function hasUserVoted(uint256 _tokenId, address _user) public view returns (bool) {
        return valuations[_tokenId].hasVoted[_user];
    }
    
    /**
     * @dev Check if user has voted on a pending valuation
     */
    function hasUserVotedOnPending(uint256 _tokenId, address _user) public view returns (bool) {
        return pendingValuationVotes[_tokenId][_user];
    }

    /**
     * @dev Get pending valuation for a property
     */
    function getPendingValuation(uint256 propertyId) external view returns (Valuation memory) {
        return pendingValuations[propertyId];
    }
    
    /**
     * @dev Get comprehensive valuation status
     * @param _tokenId Token ID of the property
     * @return hasVerified Whether there's a verified valuation
     * @return hasPending Whether there's a pending valuation
     * @return pendingIsVerified Whether the pending valuation is verified
     * @return canConfirm Whether the pending valuation can be confirmed
     */
    function getValuationStatus(uint256 _tokenId) public view returns (
        bool hasVerified,
        bool hasPending,
        bool pendingIsVerified,
        bool canConfirm
    ) {
        hasVerified = valuations[_tokenId].isVerified;
        hasPending = pendingValuations[_tokenId].estimatedValue > 0;
        pendingIsVerified = pendingValuations[_tokenId].isVerified;
        canConfirm = hasPending && pendingIsVerified && propertyNFT.isAuthorizedContract(address(this));
    }
    
    /**
     * @dev Emergency function: Get detailed error information for debugging
     * @param _tokenId Token ID to check
     * @return propertyExists Whether the property exists
     * @return isOwner Whether caller is the property owner
     * @return valuationVerified Whether pending valuation is verified
     * @return contractAuthorized Whether this contract is authorized
     */
    function debugConfirmValuation(uint256 _tokenId) public view returns (
        bool propertyExists,
        bool isOwner,
        bool valuationVerified,
        bool contractAuthorized
    ) {
        try propertyNFT.ownerOf(_tokenId) returns (address propertyOwner) {
            propertyExists = true;
            isOwner = (propertyOwner == msg.sender);
        } catch {
            propertyExists = false;
            isOwner = false;
        }
        
        valuationVerified = pendingValuations[_tokenId].isVerified;
        contractAuthorized = propertyNFT.isAuthorizedContract(address(this));
    }
}