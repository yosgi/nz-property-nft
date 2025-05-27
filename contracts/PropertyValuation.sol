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
    
    // Constants
    uint256 public constant VERIFICATION_THRESHOLD = 3;
    uint256 public constant REJECTION_THRESHOLD = 2;
    
    constructor(address _propertyNFTAddress) {
        propertyNFT = PropertyNFT(_propertyNFTAddress);
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
                // Store the values before clearing
                uint256 finalValue = valuation.estimatedValue;
                uint256 finalComparable = valuation.comparableValue;
                // Add to historical values
                historicalValues[_tokenId].push(finalValue);
                // Update the main contract's estimated value
                propertyNFT.updatePropertyValue(_tokenId, finalValue);
                // Clear pending valuation
                delete pendingValuations[_tokenId];
                emit ValuationVerified(_tokenId, true);
                emit ValuationUpdated(_tokenId, finalValue, finalComparable);
            }
        } else {
            valuation.rejectionVotes++;
            emit ValuationVoteCast(_tokenId, msg.sender, false);
            
            if (valuation.rejectionVotes >= REJECTION_THRESHOLD) {
                // Clear pending valuation and votes
                delete pendingValuations[_tokenId];
                // No need to delete the entire mapping, just let it be
                emit ValuationVerified(_tokenId, false);
            }
        }
    }
    
    /**
     * @dev Get valuation data
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
     * @dev Check if user has voted on a valuation
     */
    function hasUserVoted(uint256 _tokenId, address _user) public view returns (bool) {
        return valuations[_tokenId].hasVoted[_user];
    }

    // Get pending valuation for a property
    function getPendingValuation(uint256 propertyId) external view returns (Valuation memory) {
        return pendingValuations[propertyId];
    }
}
