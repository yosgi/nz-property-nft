# Property NFT Platform Technical Architecture

## System Overview

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js)"]
        Pages["Pages"]
        Components["Components"]
        UI["UI Library (shadcn/ui)"]
        State["State Management"]
    end

    subgraph SmartContracts["Smart Contracts (Solidity)"]
        PropertyNFT["PropertyNFT.sol"]
        Events["Contract Events"]
    end

    subgraph ExternalServices["External Services"]
        Cesium["CesiumJS"]
        GoogleMaps["Google Maps API"]
        IPFS["IPFS"]
    end

    subgraph Blockchain["Blockchain (Ethereum)"]
        MetaMask["MetaMask"]
        Provider["Ethers.js Provider"]
    end

    %% Frontend Connections
    Pages --> Components
    Components --> UI
    Components --> State
    State --> Provider

    %% Smart Contract Connections
    Provider --> PropertyNFT
    PropertyNFT --> Events
    Events --> State

    %% External Service Connections
    Components --> Cesium
    Components --> GoogleMaps
    Components --> IPFS

    %% Blockchain Connections
    MetaMask --> Provider
```

## Component Details

### Frontend Components

```mermaid
graph TB
    subgraph Pages
        MapPage["Map Page"]
        NFTPage["NFT Page"]
        SubmitPage["Submit Page"]
    end

    subgraph Components
        CesiumMap["CesiumMap"]
        CustomPopup["CustomPopup"]
        PropertyCard["PropertyCard"]
        NFTCard["NFTCard"]
    end

    subgraph State
        Properties["Properties State"]
        Loading["Loading State"]
        Error["Error State"]
    end

    %% Page to Component connections
    MapPage --> CesiumMap
    MapPage --> CustomPopup
    NFTPage --> NFTCard
    SubmitPage --> PropertyCard

    %% Component to State connections
    CesiumMap --> Properties
    CesiumMap --> Loading
    CesiumMap --> Error
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Contract
    participant Blockchain
    participant External

    User->>Frontend: Access Map Page
    Frontend->>Contract: Request Properties
    Contract->>Blockchain: Query Data
    Blockchain-->>Contract: Return Data
    Contract-->>Frontend: Properties Data
    Frontend->>External: Load Map Data
    External-->>Frontend: Map Resources
    Frontend-->>User: Display Map
```

## Technology Stack

- **Frontend Framework**: Next.js 14
- **UI Library**: shadcn/ui
- **Smart Contract**: Solidity
- **Blockchain Interaction**: Ethers.js
- **3D Map**: CesiumJS
- **Geocoding**: Google Maps API
- **Storage**: IPFS
- **Wallet**: MetaMask

## Key Features

1. **Interactive 3D Map**
   - CesiumJS integration
   - Property markers
   - Community boundaries
   - Street view integration

2. **Smart Contract Integration**
   - Property NFT minting
   - Property verification
   - Ownership management

3. **User Interface**
   - Responsive design
   - Loading states
   - Error handling
   - Interactive popups

4. **Data Management**
   - Real-time updates
   - State management
   - Data persistence 