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
    }
    
    mapping(uint256 => ValuationData) public valuations;
    mapping(uint256 => uint256[]) public historicalValues;
    
    event ValuationUpdated(uint256 indexed tokenId, uint256 estimatedValue, uint256 comparableValue);
    
    constructor(address _propertyNFTAddress) {
        propertyNFT = PropertyNFT(_propertyNFTAddress);
    }
    
    /**
     * @dev Update property valuation
     */
    function updateValuation(
        uint256 _tokenId,
        uint256 _estimatedValue,
        uint256 _comparableValue,
        uint256 _locationScore,
        uint256 _sizeScore,
        uint256 _conditionScore,
        uint256 _ageScore,
        uint256 _renovationScore
    ) public onlyOwner {
        require(propertyNFT.ownerOf(_tokenId) != address(0), "Property does not exist");
        
        ValuationData storage valuation = valuations[_tokenId];
        valuation.estimatedValue = _estimatedValue;
        valuation.comparableValue = _comparableValue;
        valuation.lastUpdated = block.timestamp;
        valuation.locationScore = _locationScore;
        valuation.sizeScore = _sizeScore;
        valuation.conditionScore = _conditionScore;
        valuation.ageScore = _ageScore;
        valuation.renovationScore = _renovationScore;
        
        // Add to historical values
        historicalValues[_tokenId].push(_estimatedValue);
        
        // Update the main contract's estimated value
        propertyNFT.updatePropertyValue(_tokenId, _estimatedValue);
        
        emit ValuationUpdated(_tokenId, _estimatedValue, _comparableValue);
    }
    
    /**
     * @dev Get valuation data
     */
    function getValuation(uint256 _tokenId) public view returns (ValuationData memory) {
        return valuations[_tokenId];
    }
    
    /**
     * @dev Get historical values
     */
    function getHistoricalValues(uint256 _tokenId) public view returns (uint256[] memory) {
        return historicalValues[_tokenId];
    }
}
