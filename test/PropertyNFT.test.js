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

    it("should allow voting on property verification", async () => {
      const result = await propertyNFT.voteOnProperty(0, true, { from: user2 })

      const voteEvent = result.logs.find(log => log.event === "VoteCast")
      assert.isNotNull(voteEvent, "VoteCast event not found")
      assert.equal(voteEvent.args.tokenId, 0)
      assert.equal(voteEvent.args.voter, user2)
      assert.equal(voteEvent.args.approve, true)
    })

    it("should not allow owner to vote on their own property", async () => {
      try {
        await propertyNFT.voteOnProperty(0, true, { from: user1 })
        assert.fail("Should have thrown an error")
      } catch (error) {
        assert.include(error.message, "Cannot vote on own property")
      }
    })

    it("should not allow double voting", async () => {
      await propertyNFT.voteOnProperty(0, true, { from: user2 })

      try {
        await propertyNFT.voteOnProperty(0, false, { from: user2 })
        assert.fail("Should have thrown an error")
      } catch (error) {
        assert.include(error.message, "Already voted")
      }
    })

    it("should verify property when threshold is reached", async () => {
      // Need 3 votes for verification
      const requiredVoters = accounts.slice(2, 5) // Get exactly 3 voters
      console.log("Number of voters:", requiredVoters.length)
      console.log("Voters:", requiredVoters)

      // Cast all votes and wait for the last one to be mined
      for (let i = 0; i < requiredVoters.length; i++) {
        const voter = requiredVoters[i]
        console.log(`Casting vote ${i + 1} from ${voter}`)
        const tx = await propertyNFT.voteOnProperty(0, true, { from: voter })
        
        // Check vote count after each vote
        const property = await propertyNFT.getProperty(0)
        console.log(`Vote ${i + 1}: verificationVotes = ${property.verificationVotes}`)
        
        // Wait for the last vote to be mined
        if (i === requiredVoters.length - 1) {
          await tx
        }
      }

      // Check if property is verified
      const property = await propertyNFT.getProperty(0)
      console.log(`Final state: verificationVotes = ${property.verificationVotes}, isVerified = ${property.isVerified}`)
      assert.equal(property.verificationVotes, 3, "Should have exactly 3 verification votes")
      assert.equal(property.isVerified, true, "Property should be verified after reaching threshold")
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

    it("should update property valuation", async () => {
      await propertyValuation.updateValuation(
        0,
        1250000, // estimated value
        1200000, // comparable value
        85, // location score
        72, // size score
        90, // condition score
        65, // age score
        88, // renovation score
        { from: owner },
      )

      const valuation = await propertyValuation.getValuation(0)
      assert.equal(valuation.estimatedValue, 1250000)
      assert.equal(valuation.comparableValue, 1200000)
      assert.equal(valuation.locationScore, 85)
    })

    it("should track historical values", async () => {
      await propertyValuation.updateValuation(0, 1200000, 1150000, 85, 72, 90, 65, 88, { from: owner })
      await propertyValuation.updateValuation(0, 1250000, 1200000, 85, 72, 90, 65, 88, { from: owner })

      const historicalValues = await propertyValuation.getHistoricalValues(0)
      assert.equal(historicalValues.length, 2)
      assert.equal(historicalValues[0], 1200000)
      assert.equal(historicalValues[1], 1250000)
    })
  })
})
