const PropertyNFT = artifacts.require("PropertyNFT")
const PropertyValuation = artifacts.require("PropertyValuation")

module.exports = async (callback) => {
  try {
    console.log("Starting deployment...")

    // Get accounts
    const accounts = await web3.eth.getAccounts()
    console.log("Deploying from account:", accounts[0])

    // Deploy PropertyNFT
    console.log("Deploying PropertyNFT...")
    const propertyNFT = await PropertyNFT.new({ from: accounts[0] })
    console.log("PropertyNFT deployed at:", propertyNFT.address)

    // Deploy PropertyValuation
    console.log("Deploying PropertyValuation...")
    const propertyValuation = await PropertyValuation.new(propertyNFT.address, { from: accounts[0] })
    console.log("PropertyValuation deployed at:", propertyValuation.address)

    // Submit a sample property
    console.log("Submitting sample property...")
    const result = await propertyNFT.submitProperty(
      "123 Blockchain Ave, Crypto City, CC 12345",
      "Alex Blockchain",
      "Single Family Home",
      Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
      "https://example.com/metadata/1",
      { from: accounts[0] },
    )

    console.log("Sample property submitted with token ID:", result.logs[0].args.tokenId.toString())

    // Update valuation for the sample property
    console.log("Updating sample property valuation...")
    await propertyValuation.updateValuation(
      0, // token ID
      1250000, // estimated value ($1,250,000)
      1200000, // comparable value ($1,200,000)
      85, // location score
      72, // size score
      90, // condition score
      65, // age score
      88, // renovation score
      { from: accounts[0] },
    )

    console.log("Sample property valuation updated")
    console.log("Deployment completed successfully!")

    callback()
  } catch (error) {
    console.error("Deployment failed:", error)
    callback(error)
  }
}
