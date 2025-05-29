import { ethers } from "hardhat";

async function main() {
  console.log("Deploying contracts...");

  // Deploy PropertyNFT
  const PropertyNFT = await ethers.getContractFactory("PropertyNFT");
  const propertyNFT = await PropertyNFT.deploy();
  await propertyNFT.waitForDeployment();
  const propertyNFTAddress = await propertyNFT.getAddress();
  console.log("PropertyNFT deployed to:", propertyNFTAddress);

  // Deploy PropertyValuation
  const PropertyValuation = await ethers.getContractFactory("PropertyValuation");
  const propertyValuation = await PropertyValuation.deploy(propertyNFTAddress);
  await propertyValuation.waitForDeployment();
  console.log("PropertyValuation deployed to:", await propertyValuation.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });