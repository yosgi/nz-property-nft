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

    // Get network info
    const networkId = await web3.eth.net.getId()
    console.log("Network ID:", networkId)

    // Update environment variables based on network
    if (networkId === 11155111) { // Sepolia
      console.log("\nUpdate your .env.sepolia file with these values:")
      console.log(`NEXT_PUBLIC_PROPERTY_NFT_ADDRESS="${propertyNFT.address}"`)
      console.log(`NEXT_PUBLIC_PROPERTY_VALUATION_ADDRESS="${propertyValuation.address}"`)
    } else { // Development (Ganache)
      console.log("\nUpdate your .env.development file with these values:")
      console.log(`NEXT_PUBLIC_PROPERTY_NFT_ADDRESS="${propertyNFT.address}"`)
      console.log(`NEXT_PUBLIC_PROPERTY_VALUATION_ADDRESS="${propertyValuation.address}"`)
    }

    callback()
  } catch (error) {
    console.error("Deployment failed:", error)
    callback(error)
  }
}
