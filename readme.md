# Property NFT Platform

A decentralized platform for property tokenization and valuation using NFTs on the Ethereum blockchain.

## Live Demo

Visit our live demo at: [https://property-nft.vercel.app](https://property-nft.vercel.app)

> Note: The demo is deployed on the Sepolia testnet. Make sure you have:
> - MetaMask installed with Sepolia network configured
> - Some Sepolia testnet ETH for gas fees
> - Testnet ETH can be obtained from [Sepolia Faucet](https://sepoliafaucet.com/)

## Features

### Property Management
- Submit new properties with detailed information
- Upload property images to IPFS
- View property details including location, type, and ownership
- Track property verification status

### Verification System
- Community-based property verification
- Voting mechanism for property approval
- Real-time tracking of verification votes
- Status indicators for verification progress

### Valuation System
- Professional property valuation submission
- Multiple valuation criteria:
  - Location score
  - Size score
  - Condition score
  - Age score
  - Renovation score
- Community voting on valuations
- Pending and verified valuation states
- Historical valuation tracking

### Interactive Map
- 3D visualization of properties using Cesium
- Property markers with status indicators
- Community boundary visualization
- Street view integration
- Building information display

### User Interface
- Modern, responsive design
- Real-time status updates
- Transaction progress indicators
- Loading states and error handling
- Mobile-friendly layout

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI Components
- Cesium for 3D mapping
- Ethers.js for blockchain interaction

### Smart Contracts
- Solidity
- OpenZeppelin contracts
- Hardhat for development and testing

### Storage
- IPFS for property images
- Ethereum blockchain for property data

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MetaMask or other Web3 wallet
- Git

### Frontend Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/property-nft.git
cd property-nft
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure Environment Variables

Create the following environment files in the root directory:

#### `.env.local` (Frontend Configuration)
```env
# Smart Contract Addresses
# The deployed PropertyNFT contract address on Sepolia
NEXT_PUBLIC_PROPERTY_NFT_ADDRESS=0x1234...5678

# The deployed PropertyValuation contract address on Sepolia
NEXT_PUBLIC_PROPERTY_VALUATION_ADDRESS=0x8765...4321

# API Keys
# Your Google Maps API key for maps and street view
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N...

# Your Cesium ion access token for 3D mapping
NEXT_PUBLIC_CESIUM_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# IPFS Configuration
# Your Infura IPFS project ID
NEXT_PUBLIC_INFURA_IPFS_PROJECT_ID=2aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV

# Your Infura IPFS project secret
NEXT_PUBLIC_INFURA_IPFS_PROJECT_SECRET=3bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW

# Blockchain Network
# Sepolia testnet network ID
NEXT_PUBLIC_NETWORK_ID=11155111

# Your Infura/Alchemy RPC URL for Sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/your-project-id

# Optional: Analytics
# Your analytics service ID (e.g., Google Analytics)
NEXT_PUBLIC_ANALYTICS_ID=G-XXXXXXXXXX
```

#### `.env.hardhat` (Local Development)
```env
# Private key for local development
PRIVATE_KEY=your_private_key_here

# Infura/Alchemy API key for local development
INFURA_API_KEY=your_infura_api_key

# Optional: Etherscan API key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key
```

#### `.env.sepolia` (Sepolia Testnet)
```env
# Private key for Sepolia deployment
PRIVATE_KEY=your_private_key_here

# Infura/Alchemy API key for Sepolia
INFURA_API_KEY=your_infura_api_key

# Etherscan API key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key

# Optional: Gas reporter configuration
REPORT_GAS=true
```

> Note: 
> - Replace all placeholder values with your actual credentials
> - Never commit any `.env` files to version control
> - Keep your private keys secure and never share them
> - For local development, you can use a test account's private key
> - For production deployment, use a secure wallet's private key

#### Google Maps Configuration
1. Get your Google Maps API key:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the following APIs:
     - Maps JavaScript API
     - Street View Static API
     - Geocoding API
   - Create credentials (API key)
   - Restrict the API key to:
     - HTTP referrers (your domain)
     - The specific APIs you enabled

#### Cesium Configuration
1. Get your Cesium ion access token:
   - Sign up at [Cesium ion](https://cesium.com/ion/signup)
   - Go to your [Access Tokens](https://cesium.com/ion/tokens) page
   - Create a new token with the following scopes:
     - `assets:read`
     - `assets:write`
     - `geocode`
     - `tilesets:read`

#### IPFS Configuration
1. Set up IPFS with Infura:
   - Create an account at [Infura](https://infura.io/)
   - Create a new IPFS project
   - Get your Project ID and Project Secret
   - Add them to your `.env.local` file

#### Blockchain Network Configuration
1. Set up your network:
   - For development: Use Sepolia testnet (Network ID: 11155111)
   - Get an RPC URL from Infura or Alchemy
   - Add the network to MetaMask:
     - Network Name: Sepolia Test Network
     - RPC URL: Your RPC URL
     - Chain ID: 11155111
     - Currency Symbol: ETH
     - Block Explorer URL: https://sepolia.etherscan.io

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Smart Contract Setup

1. Install Hardhat:
```bash
npm install --save-dev hardhat
```

2. Compile contracts:
```bash
npx hardhat compile
```

3. Deploy contracts:
```bash
npx hardhat run scripts/deploy.ts --network your_network
```

## Contract Architecture

### PropertyNFT.sol
- Main contract for property tokenization
- ERC721 implementation for property NFTs
- Property verification system
- Owner management

### PropertyValuation.sol
- Property valuation management
- Valuation verification system
- Score tracking for multiple criteria
- Historical valuation records

## Project Structure

```
property-nft/
├── app/                    # Next.js app directory
│   ├── components/        # React components
│   ├── nft/              # NFT related pages
│   ├── submit/           # Property submission page
│   └── valuation/        # Valuation related pages
├── contracts/            # Smart contracts
│   ├── PropertyNFT.sol
│   └── PropertyValuation.sol
├── scripts/              # Deployment and utility scripts
├── public/              # Static files
│   └── static/         # Cesium static files
└── test/               # Test files
```

## Development Guide

### Local Development
1. Start local blockchain:
```bash
npx hardhat node
```

2. Deploy contracts locally:
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

3. Start frontend development server:
```bash
npm run dev
```

### Code Style
- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Follow the existing component structure
- Write meaningful commit messages

### Git Workflow
1. Create a new branch for each feature/fix
2. Write tests for new features
3. Update documentation as needed
4. Create a pull request with a clear description

## Testing

### Smart Contract Tests
```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/PropertyNFT.test.ts

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test
```

### Frontend Tests
```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e
```

## Deployment

### Smart Contract Deployment

1. Deploy to Sepolia:
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

2. Verify contracts on Etherscan:
```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

### Frontend Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy to Vercel:
```bash
vercel deploy
```

## FAQ

### Common Issues

#### Contract Deployment
Q: Why am I getting "insufficient funds" error during deployment?
A: Make sure you have enough testnet ETH in your deployment wallet.

#### Frontend Issues
Q: Why is the map not loading?
A: Check if you have:
- Valid Cesium token in `.env.local`
- Proper Cesium static files in `public/static/cesium`
- Correct network configuration

Q: Why are property images not showing?
A: Verify:
- IPFS configuration in `.env.local`
- IPFS gateway is accessible
- Image upload was successful

#### Transaction Issues
Q: Why is my transaction failing?
A: Common reasons:
- Insufficient gas
- Network congestion
- Contract state mismatch
- Invalid parameters

### Performance Optimization
- Use proper caching strategies
- Optimize image loading
- Implement lazy loading for map components
- Use appropriate gas optimization techniques

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenZeppelin for smart contract libraries
- Cesium for 3D mapping capabilities
- IPFS for decentralized storage
- Next.js team for the amazing framework

## Currency Units

The platform uses New Zealand Dollar (NZD) as the primary currency for all property valuations and transactions. Here's how currency is handled throughout the platform:

### Valuation System
- All property valuations are stored and displayed in NZD
- Values are stored on-chain in Wei (1 NZD = 1e18 Wei)
- The frontend automatically converts Wei to NZD for display
- No ETH conversion is performed - values are stored directly in NZD

### Display Format
- Currency values are formatted using the NZD locale
- Example: "NZD 1,234,567.89"
- All monetary values in the UI are shown in NZD
- No ETH or other cryptocurrency conversions are displayed

### Important Notes
- When submitting valuations, enter amounts in NZD
- The system will automatically convert NZD to Wei for blockchain storage
- Historical valuations are stored and displayed in NZD
- Comparable property values are also in NZD
