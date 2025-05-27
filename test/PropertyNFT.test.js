const PropertyNFT = artifacts.require("PropertyNFT")
const PropertyValuation = artifacts.require("PropertyValuation")

contract("PropertyNFT", (accounts) => {
  let propertyNFT
  let propertyValuation
  const [owner, user1, user2, user3, ...voters] = accounts

  beforeEach(async () => {
    propertyNFT = await PropertyNFT.new({ from: owner })
    propertyValuation = await PropertyValuation.new(propertyNFT.address, { from: owner })
  })

  describe("Property Submission", () => {
    it("should submit a new property", async () => {
      const result = await propertyNFT.submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200, // Jan 1, 2023
        "https://example.com/metadata/1",
        { from: user1 },
      )

      // Find the PropertySubmitted event instead of assuming it's the first event
      const submittedEvent = result.logs.find(log => log.event === "PropertySubmitted")
      assert.isNotNull(submittedEvent, "PropertySubmitted event not found")
      assert.equal(submittedEvent.args.propertyAddress, "123 Blockchain Ave, Crypto City")
      assert.equal(submittedEvent.args.submitter, user1)
    })

    it("should not allow duplicate property addresses", async () => {
      await propertyNFT.submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        { from: user1 },
      )

      try {
        await propertyNFT.submitProperty(
          "123 Blockchain Ave, Crypto City",
          "Jane Doe",
          "Condo",
          1672531200,
          "https://example.com/metadata/2",
          { from: user2 },
        )
        assert.fail("Should have thrown an error")
      } catch (error) {
        assert.include(error.message, "Property already exists")
      }
    })
  })

  describe("Property Verification", () => {
    beforeEach(async () => {
      await propertyNFT.submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        { from: user1 },
      )
    })

    it("should allow voting on property submission verification", async () => {
      const result = await propertyNFT.voteOnProperty(0, true, { from: user2 })

      const voteEvent = result.logs.find(log => log.event === "VoteCast")
      assert.isNotNull(voteEvent, "VoteCast event not found")
      assert.equal(voteEvent.args.tokenId, 0)
      assert.equal(voteEvent.args.voter, user2)
      assert.equal(voteEvent.args.approve, true)
    })

    it("should not allow owner to vote on their own property submission", async () => {
      try {
        await propertyNFT.voteOnProperty(0, true, { from: user1 })
        assert.fail("Should have thrown an error")
      } catch (error) {
        assert.include(error.message, "Cannot vote on own property")
      }
    })

    it("should not allow double voting on property submission", async () => {
      await propertyNFT.voteOnProperty(0, true, { from: user2 })

      try {
        await propertyNFT.voteOnProperty(0, false, { from: user2 })
        assert.fail("Should have thrown an error")
      } catch (error) {
        assert.include(error.message, "Already voted")
      }
    })

    it("should verify property submission when threshold is reached", async () => {
      // Need 3 votes for verification
      const requiredVoters = accounts.slice(2, 5) // Get exactly 3 voters

      // Cast all votes
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i]
        const result = await propertyNFT.voteOnProperty(0, true, { from: voter })
        const voteEvent = result.logs.find(log => log.event === "VoteCast")
        assert.isNotNull(voteEvent, "VoteCast event not found")
        assert.equal(voteEvent.args.tokenId, 0)
        assert.equal(voteEvent.args.voter, voter)
        assert.equal(voteEvent.args.approve, true)
      }

      // Check if property is verified
      const property = await propertyNFT.getProperty(0)
      assert.equal(property.verificationVotes, 3, "Should have exactly 3 verification votes")
      assert.equal(property.isVerified, true, "Property should be verified after reaching threshold")
    })

    it("should reject property submission when rejection threshold is reached", async () => {
      // Need 2 votes for rejection
      const rejectVoters = accounts.slice(2, 4) // Get exactly 2 voters

      // Cast rejection votes
      for (let i = 0; i < rejectVoters.length; i++) {
        const voter = rejectVoters[i]
        const result = await propertyNFT.voteOnProperty(0, false, { from: voter })
        const voteEvent = result.logs.find(log => log.event === "VoteCast")
        assert.isNotNull(voteEvent, "VoteCast event not found")
        assert.equal(voteEvent.args.tokenId, 0)
        assert.equal(voteEvent.args.voter, voter)
        assert.equal(voteEvent.args.approve, false)
      }

      // Check if property was rejected
      const property = await propertyNFT.getProperty(0)
      assert.equal(property.rejectionVotes, 2, "Should have exactly 2 rejection votes")
      assert.equal(property.isVerified, false, "Property should not be verified after rejection")
    })
  })

  describe("Property Information", () => {
    beforeEach(async () => {
      await propertyNFT.submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        { from: user1 },
      )
    })

    it("should return correct property details", async () => {
      const property = await propertyNFT.getProperty(0)

      assert.equal(property.propertyAddress, "123 Blockchain Ave, Crypto City")
      assert.equal(property.ownerName, "John Doe")
      assert.equal(property.propertyType, "Single Family Home")
      assert.equal(property.renovationDate, 1672531200)
      assert.equal(property.isVerified, false)
    })

    it("should return owner properties", async () => {
      await propertyNFT.submitProperty(
        "456 Token Street, NFT Town",
        "John Doe",
        "Condo",
        1672531200,
        "https://example.com/metadata/2",
        { from: user1 },
      )

      const ownerProperties = await propertyNFT.getOwnerProperties(user1)
      assert.equal(ownerProperties.length, 2)
      assert.equal(ownerProperties[0], 0)
      assert.equal(ownerProperties[1], 1)
    })
  })

  describe("Property Valuation", () => {
    beforeEach(async () => {
      await propertyNFT.submitProperty(
        "123 Blockchain Ave, Crypto City",
        "John Doe",
        "Single Family Home",
        1672531200,
        "https://example.com/metadata/1",
        { from: user1 },
      )
      // Set the valuation contract as the owner of the NFT contract
      await propertyNFT.transferOwnership(propertyValuation.address, { from: owner })
    })

    it("should submit a new property valuation", async () => {
      const result = await propertyValuation.submitValuation(
        0,
        1250000, // estimated value
        1200000, // comparable value
        85, // location score
        72, // size score
        90, // condition score
        65, // age score
        88, // renovation score
        { from: user1 },
      )

      const submittedEvent = result.logs.find(log => log.event === "ValuationSubmitted")
      assert.isNotNull(submittedEvent, "ValuationSubmitted event not found")
      assert.equal(submittedEvent.args.tokenId, 0)
      assert.equal(submittedEvent.args.estimatedValue, 1250000)
      assert.equal(submittedEvent.args.comparableValue, 1200000)

      const valuation = await propertyValuation.getPendingValuation(0)
      assert.equal(valuation.estimatedValue, 1250000)
      assert.equal(valuation.isVerified, false)
    })

    it("should allow voting on property valuation update", async () => {
      await propertyValuation.submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88,
        { from: user1 },
      )

      const result = await propertyValuation.voteOnValuation(0, true, { from: user2 })
      const voteEvent = result.logs.find(log => log.event === "ValuationVoteCast")
      assert.isNotNull(voteEvent, "ValuationVoteCast event not found")
      assert.equal(voteEvent.args.tokenId, 0)
      assert.equal(voteEvent.args.voter, user2)
      assert.equal(voteEvent.args.approve, true)
    })

    it("should not allow owner to vote on their own valuation update", async () => {
      await propertyValuation.submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88,
        { from: user1 },
      )

      try {
        await propertyValuation.voteOnValuation(0, true, { from: user1 })
        assert.fail("Should have thrown an error")
      } catch (error) {
        assert.include(error.message, "Cannot vote on own property")
      }
    })

    it("should not allow double voting on valuation update", async () => {
      await propertyValuation.submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88,
        { from: user1 },
      )

      // First vote
      await propertyValuation.voteOnValuation(0, true, { from: user2 })

      // Try to vote again
      try {
        await propertyValuation.voteOnValuation(0, true, { from: user2 })
        assert.fail("Should have thrown an error")
      } catch (error) {
        assert.include(error.message, "Already voted")
      }
    })

    it("should verify valuation update when threshold is reached", async () => {
      await propertyValuation.submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88,
        { from: user1 },
      )

      // Need 3 votes for verification
      const requiredVoters = accounts.slice(2, 5) // Get exactly 3 voters

      // Cast all votes
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i]
        const result = await propertyValuation.voteOnValuation(0, true, { from: voter })
        const voteEvent = result.logs.find(log => log.event === "ValuationVoteCast")
        assert.isNotNull(voteEvent, "VoteCast event not found")
        assert.equal(voteEvent.args.tokenId, 0)
        assert.equal(voteEvent.args.voter, voter)
        assert.equal(voteEvent.args.approve, true)

        // After the last vote, the valuation should be verified
        if (i === requiredVoters.length - 1) {
          const verifiedEvent = result.logs.find(log => log.event === "ValuationVerified")
          assert.isNotNull(verifiedEvent, "ValuationVerified event not found")
          assert.equal(verifiedEvent.args.tokenId, 0)
          assert.equal(verifiedEvent.args.verified, true)
        }
      }

      // Owner confirms the valuation update
      const confirmResult = await propertyValuation.confirmValuationUpdate(0, { from: user1 })
      const updatedEvent = confirmResult.logs.find(log => log.event === "ValuationUpdated")
      assert.isNotNull(updatedEvent, "ValuationUpdated event not found")
      assert.equal(updatedEvent.args.tokenId, 0)
      assert.equal(updatedEvent.args.estimatedValue, 1250000)

      // Check if historical values were updated
      const historicalValues = await propertyValuation.getHistoricalValues(0)
      assert.equal(historicalValues.length, 1)
      assert.equal(historicalValues[0], 1250000)

      // Check if main contract's value was updated
      const property = await propertyNFT.getProperty(0)
      assert.equal(property.estimatedValue, 1250000)

      // Check that pending valuation was cleared
      const pendingValuation = await propertyValuation.getPendingValuation(0)
      assert.equal(pendingValuation.estimatedValue, 0, "Pending valuation should be cleared")
    })

    it("should reject valuation update when rejection threshold is reached", async () => {
      await propertyValuation.submitValuation(
        0,
        1250000,
        1200000,
        85,
        72,
        90,
        65,
        88,
        { from: user1 },
      )

      // Need 2 votes for rejection
      const rejectVoters = accounts.slice(2, 4) // Get exactly 2 voters

      // Cast rejection votes
      for (let i = 0; i < rejectVoters.length; i++) {
        const voter = rejectVoters[i]
        const result = await propertyValuation.voteOnValuation(0, false, { from: voter })
        const voteEvent = result.logs.find(log => log.event === "ValuationVoteCast")
        assert.isNotNull(voteEvent, "VoteCast event not found")
        assert.equal(voteEvent.args.tokenId, 0)
        assert.equal(voteEvent.args.voter, voter)
        assert.equal(voteEvent.args.approve, false)

        // After the last vote, the valuation should be rejected
        if (i === rejectVoters.length - 1) {
          const verifiedEvent = result.logs.find(log => log.event === "ValuationVerified")
          assert.isNotNull(verifiedEvent, "ValuationVerified event not found")
          assert.equal(verifiedEvent.args.tokenId, 0)
          assert.equal(verifiedEvent.args.verified, false)
        }
      }

      // Check that historical values were not updated
      const historicalValues = await propertyValuation.getHistoricalValues(0)
      assert.equal(historicalValues.length, 0)

      // Check that pending valuation was cleared
      const pendingValuation = await propertyValuation.getPendingValuation(0)
      assert.equal(pendingValuation.estimatedValue, 0, "Pending valuation should be cleared")
    })

    it("should handle property submission verification followed by valuation update", async () => {
      // First, verify the property submission
      const requiredVoters = accounts.slice(2, 5) // Get exactly 3 voters
      
      // Cast all votes for property verification
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i]
        await propertyNFT.voteOnProperty(0, true, { from: voter })
      }

      // Verify property is verified
      const property = await propertyNFT.getProperty(0)
      assert.equal(property.isVerified, true, "Property should be verified")

      // Now submit a valuation update
      await propertyValuation.submitValuation(
        0,
        1250000, // estimated value
        1200000, // comparable value
        85, // location score
        72, // size score
        90, // condition score
        65, // age score
        88, // renovation score
        { from: user1 },
      )

      // Use the same voters for valuation update
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i]
        const result = await propertyValuation.voteOnValuation(0, true, { from: voter })
        
        // After the last vote, check if valuation was verified
        if (i === requiredVoters.length - 1) {
          const verifiedEvent = result.logs.find(log => log.event === "ValuationVerified")
          assert.isNotNull(verifiedEvent, "ValuationVerified event not found")
          assert.equal(verifiedEvent.args.tokenId, 0)
          assert.equal(verifiedEvent.args.verified, true)
        }
      }

      // Owner confirms the valuation update
      const confirmResult = await propertyValuation.confirmValuationUpdate(0, { from: user1 })
      const updatedEvent = confirmResult.logs.find(log => log.event === "ValuationUpdated")
      assert.isNotNull(updatedEvent, "ValuationUpdated event not found")
      assert.equal(updatedEvent.args.tokenId, 0)
      assert.equal(updatedEvent.args.estimatedValue, 1250000)

      // Verify the property value was updated
      const updatedProperty = await propertyNFT.getProperty(0)
      assert.equal(updatedProperty.estimatedValue, 1250000, "Property value should be updated")

      // Verify historical values were updated
      const historicalValues = await propertyValuation.getHistoricalValues(0)
      assert.equal(historicalValues.length, 1, "Should have one historical value")
      assert.equal(historicalValues[0], 1250000, "Historical value should match the update")

      // Verify pending valuation was cleared
      const pendingValuation = await propertyValuation.getPendingValuation(0)
      assert.equal(pendingValuation.estimatedValue, 0, "Pending valuation should be cleared")
    })
  })
})
