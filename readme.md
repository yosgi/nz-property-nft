# Property NFT Smart Contracts

This repository contains the smart contracts for the Property NFT platform, built with Truffle and designed to work with Ganache.

## Features

- **PropertyNFT Contract**: Main ERC-721 contract for property tokenization
- **PropertyValuation Contract**: Handles property valuation and historical data
- **Community Verification**: Blockchain-based voting system for property verification
- **Ownership Tracking**: Complete ownership history and transfer functionality

## Prerequisites

- Node.js (v14 or higher)
- Truffle Suite
- Ganache (GUI or CLI)
- MetaMask (for frontend interaction)

## Installation

1. Clone the repository and install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start Ganache:
   - **Ganache GUI**: Open Ganache and create a new workspace on port 7545
   - **Ganache CLI**: Run `npm run ganache`

3. Compile the contracts:
\`\`\`bash
npm run compile
\`\`\`

4. Deploy the contracts:
\`\`\`bash
npm run migrate
# or for reset deployment
npm run migrate:reset
\`\`\`

## Contract Addresses

After deployment, you'll see the contract addresses in the console. Update your frontend configuration with these addresses.

## Testing

Run the test suite:
\`\`\`bash
npm test
\`\`\`

## Usage

### Submitting a Property

\`\`\`javascript
await propertyNFT.submitProperty(
  "123 Main St, City, State, ZIP",
  "John Doe",
  "Single Family Home",
  renovationTimestamp,
  "https://metadata-uri.com/1"
);
\`\`\`

### Voting on Verification

\`\`\`javascript
await propertyNFT.voteOnProperty(tokenId, true); // true for approve, false for reject
\`\`\`

### Updating Valuation

\`\`\`javascript
await propertyValuation.updateValuation(
  tokenId,
  estimatedValue,
  comparableValue,
  locationScore,
  sizeScore,
  conditionScore,
  ageScore,
  renovationScore
);
\`\`\`

## Network Configuration

The contracts are configured for:
- **Development**: Ganache GUI (port 7545)
- **Ganache CLI**: Ganache CLI (port 8545)

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Ownable**: Access control for administrative functions
- **Vote Prevention**: Users cannot vote on their own properties
- **Double Vote Prevention**: Users cannot vote twice on the same property

## Gas Optimization

- Efficient storage patterns
- Optimized loops and mappings
- Minimal external calls

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details
