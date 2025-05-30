const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("PropertyNFT", function () {
  let propertyNFT;
  let propertyValuation;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let addr4;
  let addr5;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    const PropertyNFTFactory = await ethers.getContractFactory("PropertyNFT");
    const PropertyValuationFactory = await ethers.getContractFactory("PropertyValuation");
    [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();

    // Deploy a new PropertyNFT contract before each test
    propertyNFT = await PropertyNFTFactory.deploy();
    propertyValuation = await PropertyValuationFactory.deploy(await propertyNFT.getAddress());
    
    // Authorize PropertyValuation contract to update PropertyNFT values
    await propertyNFT.connect(owner).setAuthorizedContract(await propertyValuation.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await propertyNFT.owner()).to.equal(owner.address);
    });

    it("Should authorize PropertyValuation contract", async function () {
      const isAuthorized = await propertyNFT.isAuthorizedContract(await propertyValuation.getAddress());
      expect(isAuthorized).to.equal(true);
    });
  });

  describe("Authorization Management", function () {
    it("Should allow owner to authorize contracts", async function () {
      const testAddress = addr1.address;
      
      // Initially not authorized
      expect(await propertyNFT.isAuthorizedContract(testAddress)).to.equal(false);
      
      // Authorize
      await propertyNFT.connect(owner).setAuthorizedContract(testAddress, true);
      expect(await propertyNFT.isAuthorizedContract(testAddress)).to.equal(true);
      
      // Deauthorize
      await propertyNFT.connect(owner).setAuthorizedContract(testAddress, false);
      expect(await propertyNFT.isAuthorizedContract(testAddress)).to.equal(false);
    });

    it("Should not allow non-owner to authorize contracts", async function () {
      await expect(
        propertyNFT.connect(addr1).setAuthorizedContract(addr2.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should check authorization status correctly", async function () {
      const status = await propertyValuation.checkAuthorizationStatus();
      expect(status.authorized).to.equal(true);
      expect(status.nftContract).to.equal(await propertyNFT.getAddress());
      expect(status.thisContract).to.equal(await propertyValuation.getAddress());
    });
  });

  describe("Property Submission", () => {
    it("should submit a new property", async () => {
      const tx = await propertyNFT.connect(addr1).submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200, // Jan 1, 2023
        "https://example.com/metadata/1",
        -36917208, // latitude * 1000000
        174764632 // longitude * 1000000
      );

      const receipt = await tx.wait();
      const submittedEvent = receipt.logs.find(log => log.fragment?.name === "PropertySubmitted");
      expect(submittedEvent).to.not.be.null;
      expect(submittedEvent.args.propertyAddress).to.equal("123 Blockchain Ave, Crypto City");
      expect(submittedEvent.args.submitter).to.equal(addr1.address);
      
      // Check for MetadataUpdate event
      const metadataEvent = receipt.logs.find(log => log.fragment?.name === "MetadataUpdate");
      expect(metadataEvent).to.not.be.null;
      expect(metadataEvent.args._tokenId).to.equal(0);
    });

    it("should not allow duplicate property addresses", async () => {
      await propertyNFT.connect(addr1).submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        -36917208,
        174764632
      );

      await expect(
        propertyNFT.connect(addr2).submitProperty(
          "123 Blockchain Ave, Crypto City",
          "Jane Doe",
          "Condo",
          1672531200,
          "https://example.com/metadata/2",
          -36917208,
          174764632
        )
      ).to.be.revertedWith("Property already exists");
    });
  });

  describe("NFT Metadata", () => {
    beforeEach(async () => {
      await propertyNFT.connect(addr1).submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        -36917208,
        174764632
      );
    });

    it("should generate basic metadata for new property", async () => {
      const tokenURI = await propertyNFT.tokenURI(0);
      expect(tokenURI).to.include("data:application/json;base64,");
      
      // Decode and parse JSON
      const base64Data = tokenURI.replace("data:application/json;base64,", "");
      const jsonString = Buffer.from(base64Data, 'base64').toString();
      const metadata = JSON.parse(jsonString);
      
      expect(metadata.name).to.include("Property #0");
      expect(metadata.name).to.include("123 Blockchain Ave, Crypto City");
      expect(metadata.description).to.include("Verified property NFT");
      expect(metadata.image).to.equal("https://example.com/metadata/1");
      expect(metadata.attributes).to.be.an('array');
      
      // Check basic attributes
      const propertyTypeAttr = metadata.attributes.find(attr => attr.trait_type === "Property Type");
      expect(propertyTypeAttr.value).to.equal("Single Family Home");
      
      const ownerAttr = metadata.attributes.find(attr => attr.trait_type === "Owner");
      expect(ownerAttr.value).to.equal("John Doe");
      
      const verificationAttr = metadata.attributes.find(attr => attr.trait_type === "Verification Status");
      expect(verificationAttr.value).to.equal("Pending");
    });

    it("should update metadata when property is verified", async () => {
      // Vote to verify property
      const requiredVoters = [addr2, addr3, addr4];
      for (let voter of requiredVoters) {
        await propertyNFT.connect(voter).voteOnProperty(0, true);
      }

      const tokenURI = await propertyNFT.tokenURI(0);
      const base64Data = tokenURI.replace("data:application/json;base64,", "");
      const jsonString = Buffer.from(base64Data, 'base64').toString();
      const metadata = JSON.parse(jsonString);
      
      const verificationAttr = metadata.attributes.find(attr => attr.trait_type === "Verification Status");
      expect(verificationAttr.value).to.equal("Verified");
    });

    it("should include valuation scores in metadata after valuation update", async () => {
      // Submit and approve valuation
      await propertyValuation.connect(addr1).submitValuation(0, 1250000, 1200000, 85, 72, 90, 65, 88);
      
      const requiredVoters = [addr2, addr3, addr4];
      for (let voter of requiredVoters) {
        await propertyValuation.connect(voter).voteOnValuation(0, true);
      }
      
      // Confirm valuation
      await propertyValuation.connect(addr1).confirmValuationUpdate(0);
      
      const tokenURI = await propertyNFT.tokenURI(0);
      const base64Data = tokenURI.replace("data:application/json;base64,", "");
      const jsonString = Buffer.from(base64Data, 'base64').toString();
      const metadata = JSON.parse(jsonString);
      
      // Check for score attributes
      const locationScore = metadata.attributes.find(attr => attr.trait_type === "Location Score");
      expect(Number(locationScore.value)).to.equal(85);
      expect(locationScore.display_type).to.equal("boost_percentage");
      
      const sizeScore = metadata.attributes.find(attr => attr.trait_type === "Size Score");
      expect(Number(sizeScore.value)).to.equal(72);
      
      const conditionScore = metadata.attributes.find(attr => attr.trait_type === "Condition Score");
      expect(Number(conditionScore.value)).to.equal(90);
      
      const ageScore = metadata.attributes.find(attr => attr.trait_type === "Age Score");
      expect(Number(ageScore.value)).to.equal(65);
      
      const renovationScore = metadata.attributes.find(attr => attr.trait_type === "Renovation Score");
      expect(Number(renovationScore.value)).to.equal(88);
      
      // Check overall score (should be average: (85+72+90+65+88)/5 = 80)
      const overallScore = metadata.attributes.find(attr => attr.trait_type === "Overall Score");
      expect(Number(overallScore.value)).to.equal(80);
    });
  });

  describe("Property Verification", () => {
    beforeEach(async () => {
      await propertyNFT.connect(addr1).submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        -36917208,
        174764632
      );
    });

    it("should allow voting on property submission verification", async () => {
      const tx = await propertyNFT.connect(addr2).voteOnProperty(0, true);
      const receipt = await tx.wait();
      const voteEvent = receipt.logs.find(log => log.fragment?.name === "VoteCast");
      
      expect(voteEvent).to.not.be.null;
      expect(voteEvent.args.tokenId).to.equal(0);
      expect(voteEvent.args.voter).to.equal(addr2.address);
      expect(voteEvent.args.approve).to.equal(true);
    });

    it("should not allow owner to vote on their own property submission", async () => {
      await expect(
        propertyNFT.connect(addr1).voteOnProperty(0, true)
      ).to.be.revertedWith("Cannot vote on own property");
    });

    it("should not allow double voting on property submission", async () => {
      await propertyNFT.connect(addr2).voteOnProperty(0, true);

      await expect(
        propertyNFT.connect(addr2).voteOnProperty(0, false)
      ).to.be.revertedWith("Already voted");
    });

    it("should verify property submission when threshold is reached", async () => {
      // Need 3 votes for verification
      const requiredVoters = [addr2, addr3, addr4];

      // Cast all votes
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i];
        const tx = await propertyNFT.connect(voter).voteOnProperty(0, true);
        const receipt = await tx.wait();
        const voteEvent = receipt.logs.find(log => log.fragment?.name === "VoteCast");
        
        expect(voteEvent).to.not.be.null;
        expect(voteEvent.args.tokenId).to.equal(0);
        expect(voteEvent.args.voter).to.equal(voter.address);
        expect(voteEvent.args.approve).to.equal(true);
        
        // Check for MetadataUpdate event on final vote
        if (i === requiredVoters.length - 1) {
          const metadataEvent = receipt.logs.find(log => log.fragment?.name === "MetadataUpdate");
          expect(metadataEvent).to.not.be.null;
        }
      }

      // Check if property is verified
      const property = await propertyNFT.properties(0);
      expect(property.verificationVotes).to.equal(3, "Should have exactly 3 verification votes");
      expect(property.isVerified).to.equal(true, "Property should be verified after reaching threshold");
    });

    it("should reject property submission when rejection threshold is reached", async () => {
      // Need 2 votes for rejection
      const rejectVoters = [addr2, addr3];

      // Cast rejection votes
      for (let i = 0; i < rejectVoters.length; i++) {
        const voter = rejectVoters[i];
        const tx = await propertyNFT.connect(voter).voteOnProperty(0, false);
        const receipt = await tx.wait();
        const voteEvent = receipt.logs.find(log => log.fragment?.name === "VoteCast");
        
        expect(voteEvent).to.not.be.null;
        expect(voteEvent.args.tokenId).to.equal(0);
        expect(voteEvent.args.voter).to.equal(voter.address);
        expect(voteEvent.args.approve).to.equal(false);
        
        // Check for MetadataUpdate event on final vote
        if (i === rejectVoters.length - 1) {
          const metadataEvent = receipt.logs.find(log => log.fragment?.name === "MetadataUpdate");
          expect(metadataEvent).to.not.be.null;
        }
      }

      // Check if property was rejected
      const property = await propertyNFT.properties(0);
      expect(property.rejectionVotes).to.equal(2, "Should have exactly 2 rejection votes");
      expect(property.isVerified).to.equal(false, "Property should not be verified after rejection");
    });
  });

  describe("Property Information", () => {
    beforeEach(async () => {
      await propertyNFT.connect(addr1).submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        -36917208,
        174764632
      );
    });

    it("should return correct property details", async () => {
      const property = await propertyNFT.properties(0);

      expect(property.propertyAddress).to.equal("123 Blockchain Ave, Crypto City");
      expect(property.ownerName).to.equal("John Doe");
      expect(property.propertyType).to.equal("Single Family Home");
      expect(property.renovationDate.toString()).to.equal("1672531200");
      expect(property.imageURI).to.equal("https://example.com/metadata/1");
      expect(property.latitude.toString()).to.equal("-36917208");
      expect(property.longitude.toString()).to.equal("174764632");
      expect(property.isVerified).to.equal(false);
      expect(property.estimatedValue.toString()).to.equal("0");
      expect(property.verificationVotes.toString()).to.equal("0");
      expect(property.rejectionVotes.toString()).to.equal("0");
    });

    it("should return property valuation details", async () => {
      // Submit and confirm a valuation first
      await propertyValuation.connect(addr1).submitValuation(0, 1250000, 1200000, 85, 72, 90, 65, 88);
      
      const requiredVoters = [addr2, addr3, addr4];
      for (let voter of requiredVoters) {
        await propertyValuation.connect(voter).voteOnValuation(0, true);
      }
      
      // Confirm valuation and wait for transaction to complete
      const confirmTx = await propertyValuation.connect(addr1).confirmValuationUpdate(0);
      await confirmTx.wait();
      
      // Get the property details
      const property = await propertyNFT.properties(0);
      expect(property.estimatedValue.toString()).to.equal("1250000");
      
      // Get the valuation details
      const valuation = await propertyValuation.getPendingValuation(0);
      expect(valuation.estimatedValue.toString()).to.equal("0"); // Should be cleared after confirmation
      expect(valuation.comparableValue.toString()).to.equal("0"); // Should be cleared after confirmation
      expect(valuation.locationScore.toString()).to.equal("0"); // Should be cleared after confirmation
      expect(valuation.sizeScore.toString()).to.equal("0"); // Should be cleared after confirmation
      expect(valuation.conditionScore.toString()).to.equal("0"); // Should be cleared after confirmation
      expect(valuation.ageScore.toString()).to.equal("0"); // Should be cleared after confirmation
      expect(valuation.renovationScore.toString()).to.equal("0"); // Should be cleared after confirmation
    });

    it("should return owner properties", async () => {
      await propertyNFT.connect(addr1).submitProperty(
        "456 Token Street, NFT Town",
        "John Doe",
        "Condo",
        1672531200,
        "https://example.com/metadata/2",
        -36917208,
        174764632
      );

      const property = await propertyNFT.properties(0);
      expect(property.ownerName).to.equal("John Doe");
      
      const property2 = await propertyNFT.properties(1);
      expect(property2.ownerName).to.equal("John Doe");
    });
  });

  describe("Property Valuation", () => {
    beforeEach(async () => {
      await propertyNFT.connect(addr1).submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        -36917208,
        174764632
      );
    });

    it("should submit a new property valuation", async () => {
      const tx = await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      const receipt = await tx.wait();
      const submittedEvent = receipt.logs.find(log => log.fragment?.name === "ValuationSubmitted");
      expect(submittedEvent).to.not.be.null;
      expect(submittedEvent.args.tokenId).to.equal(0);
      expect(submittedEvent.args.estimatedValue).to.equal(1250000);
      expect(submittedEvent.args.comparableValue).to.equal(1200000);

      const valuation = await propertyValuation.getPendingValuation(0);
      expect(valuation.estimatedValue).to.equal(1250000);
      expect(valuation.isVerified).to.equal(false);
    });

    it("should validate score ranges", async () => {
      await expect(
        propertyValuation.connect(addr1).submitValuation(0, 1250000, 1200000, 150, 72, 90, 65, 88)
      ).to.be.revertedWith("Location score must be <= 100");
      
      await expect(
        propertyValuation.connect(addr1).submitValuation(0, 1250000, 1200000, 85, 150, 90, 65, 88)
      ).to.be.revertedWith("Size score must be <= 100");
    });

    it("should allow voting on property valuation update", async () => {
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      const tx = await propertyValuation.connect(addr2).voteOnValuation(0, true);
      const receipt = await tx.wait();
      const voteEvent = receipt.logs.find(log => log.fragment?.name === "ValuationVoteCast");
      
      expect(voteEvent).to.not.be.null;
      expect(voteEvent.args.tokenId).to.equal(0);
      expect(voteEvent.args.voter).to.equal(addr2.address);
      expect(voteEvent.args.approve).to.equal(true);
    });

    it("should not allow owner to vote on their own valuation update", async () => {
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      await expect(
        propertyValuation.connect(addr1).voteOnValuation(0, true)
      ).to.be.revertedWith("Cannot vote on own property");
    });

    it("should not allow double voting on valuation update", async () => {
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      // First vote
      await propertyValuation.connect(addr2).voteOnValuation(0, true);

      // Try to vote again
      await expect(
        propertyValuation.connect(addr2).voteOnValuation(0, true)
      ).to.be.revertedWith("Already voted");
    });

    it("should verify valuation update when threshold is reached", async () => {
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      // Need 3 votes for verification
      const requiredVoters = [addr2, addr3, addr4];

      // Cast all votes
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i];
        const tx = await propertyValuation.connect(voter).voteOnValuation(0, true);
        const receipt = await tx.wait();
        const voteEvent = receipt.logs.find(log => log.fragment?.name === "ValuationVoteCast");
        
        expect(voteEvent).to.not.be.null;
        expect(voteEvent.args.tokenId).to.equal(0);
        expect(voteEvent.args.voter).to.equal(voter.address);
        expect(voteEvent.args.approve).to.equal(true);

        // After the last vote, the valuation should be verified
        if (i === requiredVoters.length - 1) {
          const verifiedEvent = receipt.logs.find(log => log.fragment?.name === "ValuationVerified");
          expect(verifiedEvent).to.not.be.null;
          expect(verifiedEvent.args.tokenId).to.equal(0);
          expect(verifiedEvent.args.verified).to.equal(true);
        }
      }

      // Owner confirms the valuation update
      const confirmTx = await propertyValuation.connect(addr1).confirmValuationUpdate(0);
      const confirmReceipt = await confirmTx.wait();
      const updatedEvent = confirmReceipt.logs.find(log => log.fragment?.name === "ValuationUpdated");
      
      expect(updatedEvent).to.not.be.null;
      expect(updatedEvent.args.tokenId).to.equal(0);
      expect(updatedEvent.args.estimatedValue).to.equal(1250000);

      // Check if historical values were updated
      const historicalValues = await propertyValuation.getHistoricalValues(0);
      expect(historicalValues.length).to.equal(1);
      expect(historicalValues[0].toString()).to.equal("1250000");

      // Check if main contract's value was updated
      const property = await propertyNFT.properties(0);
      expect(property.estimatedValue.toString()).to.equal("1250000");
      
      // Check if NFT valuation scores were updated in the PropertyNFT contract
      expect(property.locationScore.toString()).to.equal("85");
      expect(property.sizeScore.toString()).to.equal("72");
      expect(property.conditionScore.toString()).to.equal("90");
      expect(property.ageScore.toString()).to.equal("65");
      expect(property.renovationScore.toString()).to.equal("88");

      // Check that pending valuation was cleared
      const pendingValuation = await propertyValuation.getPendingValuation(0);
      expect(pendingValuation.estimatedValue.toString()).to.equal("0", "Pending valuation should be cleared");
    });

    it("should fail to confirm valuation without authorization", async () => {
      // Remove authorization temporarily
      await propertyNFT.connect(owner).setAuthorizedContract(await propertyValuation.getAddress(), false);
      
      await propertyValuation.connect(addr1).submitValuation(0, 1250000, 1200000, 85, 72, 90, 65, 88);
      
      const requiredVoters = [addr2, addr3, addr4];
      for (let voter of requiredVoters) {
        await propertyValuation.connect(voter).voteOnValuation(0, true);
      }

      await expect(
        propertyValuation.connect(addr1).confirmValuationUpdate(0)
      ).to.be.revertedWith("Contract not authorized to update values");
      
      // Restore authorization for other tests
      await propertyNFT.connect(owner).setAuthorizedContract(await propertyValuation.getAddress(), true);
    });

    it("should reject valuation update when rejection threshold is reached", async () => {
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      // Need 2 votes for rejection
      const rejectVoters = [addr2, addr3];

      // Cast rejection votes
      for (let i = 0; i < rejectVoters.length; i++) {
        const voter = rejectVoters[i];
        const tx = await propertyValuation.connect(voter).voteOnValuation(0, false);
        const receipt = await tx.wait();
        const voteEvent = receipt.logs.find(log => log.fragment?.name === "ValuationVoteCast");
        
        expect(voteEvent).to.not.be.null;
        expect(voteEvent.args.tokenId).to.equal(0);
        expect(voteEvent.args.voter).to.equal(voter.address);
        expect(voteEvent.args.approve).to.equal(false);

        // After the last vote, the valuation should be rejected
        if (i === rejectVoters.length - 1) {
          const verifiedEvent = receipt.logs.find(log => log.fragment?.name === "ValuationVerified");
          expect(verifiedEvent).to.not.be.null;
          expect(verifiedEvent.args.tokenId).to.equal(0);
          expect(verifiedEvent.args.verified).to.equal(false);
        }
      }

      // Check that historical values were not updated
      const historicalValues = await propertyValuation.getHistoricalValues(0);
      expect(historicalValues.length).to.equal(0);

      // Check that pending valuation was cleared
      const pendingValuation = await propertyValuation.getPendingValuation(0);
      expect(pendingValuation.estimatedValue).to.equal(0, "Pending valuation should be cleared");
    });

    it("should handle property submission verification followed by valuation update", async () => {
      // First, verify the property submission
      const requiredVoters = [addr2, addr3, addr4];
      
      // Cast all votes for property verification
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i];
        await propertyNFT.connect(voter).voteOnProperty(0, true);
      }

      // Verify property is verified
      const property = await propertyNFT.properties(0);
      expect(property.isVerified).to.equal(true, "Property should be verified");

      // Now submit a valuation update
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      // Use the same voters for valuation update
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i];
        const tx = await propertyValuation.connect(voter).voteOnValuation(0, true);
        const receipt = await tx.wait();
        
        // After the last vote, check if valuation was verified
        if (i === requiredVoters.length - 1) {
          const verifiedEvent = receipt.logs.find(log => log.fragment?.name === "ValuationVerified");
          expect(verifiedEvent).to.not.be.null;
          expect(verifiedEvent.args.tokenId).to.equal(0);
          expect(verifiedEvent.args.verified).to.equal(true);
        }
      }

      // Owner confirms the valuation update
      const confirmTx = await propertyValuation.connect(addr1).confirmValuationUpdate(0);
      const confirmReceipt = await confirmTx.wait();
      const updatedEvent = confirmReceipt.logs.find(log => log.fragment?.name === "ValuationUpdated");
      
      expect(updatedEvent).to.not.be.null;
      expect(updatedEvent.args.tokenId).to.equal(0);
      expect(updatedEvent.args.estimatedValue).to.equal(1250000);

      // Verify the property value was updated
      const updatedProperty = await propertyNFT.properties(0);
      expect(updatedProperty.estimatedValue.toString()).to.equal("1250000", "Property value should be updated");

      // Verify historical values were updated
      const historicalValues = await propertyValuation.getHistoricalValues(0);
      expect(historicalValues.length).to.equal(1, "Should have one historical value");
      expect(historicalValues[0].toString()).to.equal("1250000", "Historical value should match the update");

      // Verify pending valuation was cleared
      const pendingValuation = await propertyValuation.getPendingValuation(0);
      expect(pendingValuation.estimatedValue.toString()).to.equal("0", "Pending valuation should be cleared");
    });
  });

  describe("Valuation Status and Debugging", () => {
    beforeEach(async () => {
      await propertyNFT.connect(addr1).submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        -36917208,
        174764632
      );
    });

    it("should return correct valuation status", async () => {
      // Initially no valuations
      const initialStatus = await propertyValuation.getValuationStatus(0);
      expect(initialStatus.hasVerified).to.equal(false);
      expect(initialStatus.pendingIsVerified).to.equal(false);
      expect(initialStatus.canConfirm).to.equal(false);

      // Submit a valuation
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      // Check status after submission
      const submittedStatus = await propertyValuation.getValuationStatus(0);
      expect(submittedStatus.hasVerified).to.equal(false);
      expect(submittedStatus.pendingIsVerified).to.equal(false);
      expect(submittedStatus.canConfirm).to.equal(false);

      // Add some votes
      await propertyValuation.connect(addr2).voteOnValuation(0, true);
      await propertyValuation.connect(addr3).voteOnValuation(0, true);

      // Check status after votes
      const votedStatus = await propertyValuation.getValuationStatus(0);
      expect(votedStatus.hasVerified).to.equal(false);
      expect(votedStatus.pendingIsVerified).to.equal(false);
      expect(votedStatus.canConfirm).to.equal(false);

      // // Complete verification
      await propertyValuation.connect(addr4).voteOnValuation(0, true);
      await propertyValuation.connect(addr1).confirmValuationUpdate(0);

      // // Check final status
      const finalStatus = await propertyValuation.getValuationStatus(0);
      expect(finalStatus.hasVerified).to.equal(true);
      expect(finalStatus.pendingIsVerified).to.equal(false);
      expect(finalStatus.canConfirm).to.equal(false);
    });

    it("should return correct debug information", async () => {
      // Submit a valuation
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      // Get debug info using getValuationStatus and getPendingValuation
      const status = await propertyValuation.getValuationStatus(0);
      const pendingValuation = await propertyValuation.getPendingValuation(0);
      
      expect(pendingValuation.estimatedValue.toString()).to.equal("1250000");
      expect(pendingValuation.comparableValue.toString()).to.equal("1200000");
      expect(pendingValuation.locationScore.toString()).to.equal("85");
      expect(pendingValuation.sizeScore.toString()).to.equal("72");
      expect(pendingValuation.conditionScore.toString()).to.equal("90");
      expect(pendingValuation.ageScore.toString()).to.equal("65");
      expect(pendingValuation.renovationScore.toString()).to.equal("88");
      expect(pendingValuation.isVerified).to.equal(false);
      expect(pendingValuation.verificationVotes.toString()).to.equal("0");

      // Add some votes
      await propertyValuation.connect(addr2).voteOnValuation(0, true);
      await propertyValuation.connect(addr3).voteOnValuation(0, true);

      // Check updated debug info
      const updatedStatus = await propertyValuation.getValuationStatus(0);
      const updatedPendingValuation = await propertyValuation.getPendingValuation(0);
      expect(updatedPendingValuation.verificationVotes.toString()).to.equal("2");
      expect(updatedPendingValuation.isVerified).to.equal(false);

      // Complete verification
      await propertyValuation.connect(addr4).voteOnValuation(0, true);
      await propertyValuation.connect(addr1).confirmValuationUpdate(0);

      // Check final debug info
      const finalStatus = await propertyValuation.getValuationStatus(0);
      const historicalValues = await propertyValuation.getHistoricalValues(0);
      expect(historicalValues.length).to.equal(1);
      expect(historicalValues[0].toString()).to.equal("1250000");
    });

    it("should handle valuation rejection in debug info", async () => {
      // Submit a valuation
      await propertyValuation.connect(addr1).submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88
      );

      // Reject the valuation
      await propertyValuation.connect(addr2).voteOnValuation(0, false);
      await propertyValuation.connect(addr3).voteOnValuation(0, false);

      // Check debug info after rejection
      const status = await propertyValuation.getValuationStatus(0);
      const historicalValues = await propertyValuation.getHistoricalValues(0);
      expect(historicalValues.length).to.equal(0);
    });
  });
});