const PropertyNFT = artifacts.require("PropertyNFT")
const PropertyValuation = artifacts.require("PropertyValuation")

module.exports = async (deployer) => {
  // Deploy PropertyNFT first
  await deployer.deploy(PropertyNFT)
  const propertyNFT = await PropertyNFT.deployed()

  // Deploy PropertyValuation with PropertyNFT address
  await deployer.deploy(PropertyValuation, propertyNFT.address)
  const propertyValuation = await PropertyValuation.deployed()

  // Transfer ownership of PropertyNFT to PropertyValuation
  await propertyNFT.transferOwnership(propertyValuation.address)

  console.log("PropertyNFT deployed at:", propertyNFT.address)
  console.log("PropertyValuation deployed at:", propertyValuation.address)
  console.log("PropertyNFT ownership transferred to PropertyValuation")
}
