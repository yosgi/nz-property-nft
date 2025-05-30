import { ethers } from "hardhat"; 

async function main() {
  console.log("Starting deployment process...");
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider?.getBalance(deployer.address))?.toString());

  console.log("\nDeploying PropertyNFT...");
  const PropertyNFT = await ethers.getContractFactory("PropertyNFT");
  const propertyNFT = await PropertyNFT.deploy();
  await propertyNFT.waitForDeployment();
  const propertyNFTAddress = await propertyNFT.getAddress();
  console.log("PropertyNFT deployed to:", propertyNFTAddress);

  console.log("\nDeploying PropertyValuation...");
  const PropertyValuation = await ethers.getContractFactory("PropertyValuation");
  const propertyValuation = await PropertyValuation.deploy(propertyNFTAddress);
  await propertyValuation.waitForDeployment();
  const propertyValuationAddress = await propertyValuation.getAddress();
  console.log("PropertyValuation deployed to:", propertyValuationAddress);

  console.log("\nDeployment completed successfully!");
  console.log("Contract addresses:");
  console.log("PropertyNFT:", propertyNFTAddress);
  console.log("PropertyValuation:", propertyValuationAddress);
}

main().catch((error) => {
  console.error("Deployment failed!");
  console.error(error);
  process.exit(1);
});