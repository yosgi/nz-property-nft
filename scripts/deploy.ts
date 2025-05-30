// scripts/deploy.ts
const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment process...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying contracts with the account:", deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  console.log("\n📄 Deploying PropertyNFT...");
  const PropertyNFT = await hre.ethers.getContractFactory("PropertyNFT");
  const propertyNFT = await PropertyNFT.deploy();
  await propertyNFT.waitForDeployment();
  const propertyNFTAddress = await propertyNFT.getAddress();
  console.log("✅ PropertyNFT deployed to:", propertyNFTAddress);

  console.log("\n📄 Deploying PropertyValuation...");
  const PropertyValuation = await hre.ethers.getContractFactory("PropertyValuation");
  const propertyValuation = await PropertyValuation.deploy(propertyNFTAddress);
  await propertyValuation.waitForDeployment();
  const propertyValuationAddress = await propertyValuation.getAddress();
  console.log("✅ PropertyValuation deployed to:", propertyValuationAddress);

  // Important: Authorize PropertyValuation contract to update PropertyNFT values
  console.log("\n🔐 Setting up contract authorization...");
  try {
    const authTx = await propertyNFT.setAuthorizedContract(propertyValuationAddress, true);
    await authTx.wait();
    console.log("✅ PropertyValuation contract authorized to update property values");
    
    // Verify authorization status
    const isAuthorized = await propertyNFT.isAuthorizedContract(propertyValuationAddress);
    console.log("🔍 Authorization status verified:", isAuthorized);
    
    if (!isAuthorized) {
      throw new Error("Authorization verification failed");
    }
  } catch (error) {
    console.error("❌ Failed to authorize PropertyValuation contract:");
    console.error(error);
    throw error;
  }

  // Verify deployment status
  console.log("\n🔍 Verifying deployment...");
  try {
    // Check PropertyNFT owner
    const nftOwner = await propertyNFT.owner();
    console.log("PropertyNFT owner:", nftOwner);
    console.log("Deployer address:", deployer.address);
    console.log("Owner matches deployer:", nftOwner.toLowerCase() === deployer.address.toLowerCase());

    // Check PropertyValuation configuration
    const linkedNFTAddress = await propertyValuation.propertyNFT();
    console.log("PropertyValuation linked NFT:", linkedNFTAddress);
    console.log("Addresses match:", linkedNFTAddress.toLowerCase() === propertyNFTAddress.toLowerCase());

    // Check constants
    const verificationThreshold = await propertyNFT.VERIFICATION_THRESHOLD();
    const rejectionThreshold = await propertyNFT.REJECTION_THRESHOLD();
    console.log("Verification threshold:", verificationThreshold.toString());
    console.log("Rejection threshold:", rejectionThreshold.toString());

  } catch (error) {
    console.error("❌ Deployment verification failed:");
    console.error(error);
    throw error;
  }

  console.log("\n🎉 Deployment completed successfully!");
  console.log("📋 Contract Summary:");
  console.log("┌─────────────────────┬──────────────────────────────────────────────┐");
  console.log("│ Contract            │ Address                                      │");
  console.log("├─────────────────────┼──────────────────────────────────────────────┤");
  console.log(`│ PropertyNFT         │ ${propertyNFTAddress} │`);
  console.log(`│ PropertyValuation   │ ${propertyValuationAddress} │`);
  console.log("└─────────────────────┴──────────────────────────────────────────────┘");

  // Generate environment variables configuration
  console.log("\n📝 Environment Variables for Frontend:");
  console.log(`NEXT_PUBLIC_PROPERTY_NFT_ADDRESS=${propertyNFTAddress}`);
  console.log(`NEXT_PUBLIC_PROPERTY_VALUATION_ADDRESS=${propertyValuationAddress}`);

  // Generate contract verification commands
  console.log("\n🔍 Contract Verification Commands:");
  console.log("Copy these commands to verify contracts on Etherscan:");
  console.log(`npx hardhat verify --network <network> ${propertyNFTAddress}`);
  console.log(`npx hardhat verify --network <network> ${propertyValuationAddress} ${propertyNFTAddress}`);

  // Return deployment info for other scripts
  return {
    propertyNFT: {
      address: propertyNFTAddress,
      contract: propertyNFT
    },
    propertyValuation: {
      address: propertyValuationAddress,
      contract: propertyValuation
    },
    deployer: deployer.address
  };
}

// Enhanced error handling
main()
  .then((deploymentInfo) => {
    console.log("\n✨ All operations completed successfully!");
    if (deploymentInfo) {
      console.log("🎯 Ready for testing and frontend integration!");
    }
  })
  .catch((error) => {
    console.error("\n💥 Deployment failed!");
    console.error("Error details:", error.message);
    
    if (error.code) {
      console.error("Error code:", error.code);
    }
    
    if (error.transaction) {
      console.error("Failed transaction:", error.transaction);
    }
    
    console.error("\n🔧 Troubleshooting tips:");
    console.error("1. Check your account has enough ETH for gas fees");
    console.error("2. Verify network configuration in hardhat.config.js");
    console.error("3. Ensure contracts compile successfully with: npx hardhat compile");
    
    process.exit(1);
  });