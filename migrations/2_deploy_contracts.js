const PropertyNFT = artifacts.require("PropertyNFT")
const PropertyValuation = artifacts.require("PropertyValuation")

module.exports = async (deployer) => {
  // Deploy PropertyNFT first
  await deployer.deploy(PropertyNFT)
  const propertyNFT = await PropertyNFT.deployed()

  // Deploy PropertyValuation with PropertyNFT address
  await deployer.deploy(PropertyValuation, propertyNFT.address)

  console.log("PropertyNFT deployed at:", propertyNFT.address)
  console.log("PropertyValuation deployed at:", (await PropertyValuation.deployed()).address)
}
