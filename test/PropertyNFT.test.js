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
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await propertyNFT.owner()).to.equal(owner.address);
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
      const requiredVoters = [addr2, addr3, addr4]; // Use different addresses for each vote

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
      }

      // Check if property is verified
      const property = await propertyNFT.getProperty(0);
      expect(property.verificationVotes).to.equal(3, "Should have exactly 3 verification votes");
      expect(property.isVerified).to.equal(true, "Property should be verified after reaching threshold");
    });

    it("should reject property submission when rejection threshold is reached", async () => {
      // Need 2 votes for rejection
      const rejectVoters = [addr2, addr3]; // Use different addresses for each vote

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
      }

      // Check if property was rejected
      const property = await propertyNFT.getProperty(0);
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
      const property = await propertyNFT.getProperty(0);

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

      const ownerProperties = await propertyNFT.getOwnerProperties(addr1.address);
      expect(ownerProperties.length).to.equal(2);
      expect(ownerProperties[0]).to.equal(0);
      expect(ownerProperties[1]).to.equal(1);
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
      // Set the valuation contract as the owner of the NFT contract
      await propertyNFT.connect(owner).transferOwnership(await propertyValuation.getAddress());
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
      const requiredVoters = [addr2, addr3, addr4]; // Use different addresses for each vote

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
      expect(historicalValues[0]).to.equal(1250000);

      // Check if main contract's value was updated
      const property = await propertyNFT.getProperty(0);
      expect(property.estimatedValue).to.equal(1250000);

      // Check that pending valuation was cleared
      const pendingValuation = await propertyValuation.getPendingValuation(0);
      expect(pendingValuation.estimatedValue).to.equal(0, "Pending valuation should be cleared");
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
      const rejectVoters = [addr2, addr3]; // Use different addresses for each vote

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
      const requiredVoters = [addr2, addr3, addr4]; // Use different addresses for each vote
      
      // Cast all votes for property verification
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i];
        await propertyNFT.connect(voter).voteOnProperty(0, true);
      }

      // Verify property is verified
      const property = await propertyNFT.getProperty(0);
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
      const updatedProperty = await propertyNFT.getProperty(0);
      expect(updatedProperty.estimatedValue).to.equal(1250000, "Property value should be updated");

      // Verify historical values were updated
      const historicalValues = await propertyValuation.getHistoricalValues(0);
      expect(historicalValues.length).to.equal(1, "Should have one historical value");
      expect(historicalValues[0]).to.equal(1250000, "Historical value should match the update");

      // Verify pending valuation was cleared
      const pendingValuation = await propertyValuation.getPendingValuation(0);
      expect(pendingValuation.estimatedValue).to.equal(0, "Pending valuation should be cleared");
    });
  });
});
