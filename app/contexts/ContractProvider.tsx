"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ethers } from 'ethers'
import { toast } from "sonner"
import contractArtifact from '../../public/contracts/PropertyNFT.json'
import valuationContractArtifact from '../../public/contracts/PropertyValuation.json'
import { PropertyData, PaginationResult } from '../types/property'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""
const VALUATION_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_VALUATION_ADDRESS || ""

interface ContractContextType {
  // Core contract state
  propertyNFT: ethers.Contract | null
  propertyValuation: ethers.Contract | null
  provider: ethers.BrowserProvider | null
  signer: ethers.Signer | null
  address: string | null
  isReady: boolean

  // Connection
  connect: () => Promise<void>
  // Property operations
  submitProperty: (params: {
    propertyAddress: string
    ownerName: string
    propertyType: string
    renovationDate: number
    imageURI: string
    latitude: number
    longitude: number
  }) => Promise<ethers.ContractTransactionResponse>

  voteOnProperty: (tokenId: number, approve: boolean) => Promise<ethers.ContractTransactionResponse>

  // Valuation operations
  submitValuation: (params: {
    tokenId: number
    estimatedValue: number
    comparableValue: number
    locationScore: number
    sizeScore: number
    conditionScore: number
    ageScore: number
    renovationScore: number
  }) => Promise<ethers.ContractTransactionResponse>

  // Get properties with pagination
  getPropertiesWithPagination: (params: {
    page?: number
    limit?: number
    verifiedOnly?: boolean
    propertyType?: string
    owner?: string
  }) => Promise<PaginationResult>

  // Voting state
  submitVote: (tokenId: string, approve: boolean) => Promise<void>
  transactionPending: boolean
  votingProperty: string | null

  getProperty: (tokenId: string) => Promise<PropertyData>
  transferNFT: (tokenId: string, to: string) => Promise<ethers.ContractTransactionResponse>
  estimateTransferGas: (tokenId: string, to: string) => Promise<bigint>
  voteOnValuation: (tokenId: number, approve: boolean) => Promise<ethers.ContractTransactionResponse>
  hasUserVotedOnValuation: (tokenId: number, userAddress?: string) => Promise<boolean>
  
  // Enhanced submit vote for valuations
  submitValuationVote: (tokenId: string, approve: boolean) => Promise<void>
  // Valuation confirmation
  confirmValuationUpdate: (tokenId: number) => Promise<ethers.ContractTransactionResponse>
  
  // Check authorization status
  isContractAuthorized: () => Promise<boolean>
}

const ContractContext = createContext<ContractContextType | null>(null)

export function ContractProvider({ children }: { children: ReactNode }) {
  // Core state
  const [propertyNFT, setPropertyNFT] = useState<ethers.Contract | null>(null)
  const [propertyValuation, setPropertyValuation] = useState<ethers.Contract | null>(null)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  // Add voting state
  const [transactionPending, setTransactionPending] = useState(false)
  const [votingProperty, setVotingProperty] = useState<string | null>(null)

  // Update isReady state whenever dependencies change
  useEffect(() => {
    const ready = !!propertyNFT && !!propertyValuation && !!signer && !!provider
    setIsReady(ready)
  }, [propertyNFT, propertyValuation, signer, provider])

  // Initialize contracts
  const initializeContracts = async (signer: ethers.Signer) => {
    try {
      console.log("Initializing contracts...")
      
      if (!CONTRACT_ADDRESS || !VALUATION_CONTRACT_ADDRESS) {
        throw new Error("Contract addresses not set in environment variables")
      }

      const propertyNFTContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractArtifact.abi,
        signer
      )

      const propertyValuationContract = new ethers.Contract(
        VALUATION_CONTRACT_ADDRESS,
        valuationContractArtifact.abi,
        signer
      )

      // Verify contracts are deployed
      const nftCode = await signer.provider?.getCode(CONTRACT_ADDRESS)
      const valuationCode = await signer.provider?.getCode(VALUATION_CONTRACT_ADDRESS)

      if (nftCode === "0x" || valuationCode === "0x") {
        throw new Error("Contracts not deployed at specified addresses")
      }

      setPropertyNFT(propertyNFTContract)
      setPropertyValuation(propertyValuationContract)
      
      console.log("Contracts initialized successfully")
      return { propertyNFTContract, propertyValuationContract }
    } catch (error) {
      console.error("Error initializing contracts:", error)
      throw error
    }
  }

  // Connect wallet
  const connect = async () => {
    if (typeof window.ethereum === "undefined") {
      toast.error("Please install MetaMask to use this application")
      return
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      
      setProvider(provider)
      setSigner(signer)
      setAddress(address)
      
      await initializeContracts(signer)
      toast.success("Wallet connected successfully")
    } catch (error) {
      console.error("Error connecting wallet:", error)
      toast.error(error instanceof Error ? error.message : "Failed to connect wallet")
    }
  }

  // Ensure contracts are ready
  const ensureReady = async () => {
    if (!isReady) {
      throw new Error("Contracts are not ready. Please wait...")
    }
  }

  // Submit property
  const submitProperty = async ({
    propertyAddress,
    ownerName,
    propertyType,
    renovationDate,
    imageURI,
    latitude,
    longitude,
  }: {
    propertyAddress: string
    ownerName: string
    propertyType: string
    renovationDate: number
    imageURI: string
    latitude: number
    longitude: number
  }): Promise<ethers.ContractTransactionResponse> => {
    if (!propertyNFT || !signer) {
      toast.error("Please connect your wallet first")
      throw new Error("Wallet not connected")
    }

    try {
      setTransactionPending(true)
      const latitudeBigInt = BigInt(Math.round(latitude * 1000000))
      const longitudeBigInt = BigInt(Math.round(longitude * 1000000))

      const tx = await propertyNFT.submitProperty(
        propertyAddress,
        ownerName,
        propertyType,
        renovationDate,
        imageURI,
        latitudeBigInt,
        longitudeBigInt,
      )
      await tx.wait()
      toast.success("Property submitted successfully")
      
      // Refresh properties after submission
      await getPropertiesWithPagination({ page: 1, limit: 12 })
      return tx
    } catch (error) {
      console.error("Error submitting property:", error)
      toast.error(error instanceof Error ? error.message : "Failed to submit property")
      throw error
    } finally {
      setTransactionPending(false)
    }
  }

  // Vote on property
  const voteOnProperty = async (tokenId: number, approve: boolean) => {
    await ensureReady()
    return await propertyNFT!.voteOnProperty(tokenId, approve)
  }

  // Submit valuation
  const submitValuation = async ({
    tokenId,
    estimatedValue,
    comparableValue,
    locationScore,
    sizeScore,
    conditionScore,
    ageScore,
    renovationScore
  }: {
    tokenId: number
    estimatedValue: number
    comparableValue: number
    locationScore: number
    sizeScore: number
    conditionScore: number
    ageScore: number
    renovationScore: number
  }) => {
    await ensureReady()
    
    return await propertyValuation!.submitValuation(
      tokenId,
      BigInt(estimatedValue),
      BigInt(comparableValue),
      BigInt(locationScore),
      BigInt(sizeScore),
      BigInt(conditionScore),
      BigInt(ageScore),
      BigInt(renovationScore)
    )
  }

  // Get properties with pagination
  const getPropertiesWithPagination = async ({
    page = 1,
    limit = 12,
    verifiedOnly = false,
    propertyType,
    owner,
  }: {
    page?: number
    limit?: number
    verifiedOnly?: boolean
    propertyType?: string
    owner?: string
  } = {}): Promise<PaginationResult> => {
    await ensureReady()
    
    try {
      let properties: PropertyData[] = []
      let index = 0
      let hasMore = true

      while (hasMore) {
        try {
          const propertyData = await propertyNFT!.properties(index)
          if (!propertyData[0] || propertyData[0] === "") {
            hasMore = false
            continue
          }
          
          const owner = await propertyNFT!.ownerOf(index)
          const tokenURI = await propertyNFT!.tokenURI(index)
          const verificationVotes = BigInt(propertyData[9]?.toString() || "0")
          const rejectionVotes = BigInt(propertyData[10]?.toString() || "0")

          properties.push({
            tokenId: BigInt(index),
            propertyAddress: propertyData[0],
            ownerName: propertyData[1],
            propertyType: propertyData[2],
            renovationDate: BigInt(propertyData[3]),
            tokenURI: tokenURI || "",
            imageURI: propertyData[4] || "",
            isVerified: propertyData[7],
            estimatedValue: BigInt(propertyData[8]),
            currentOwner: owner,
            latitude: BigInt(propertyData[5]),
            longitude: BigInt(propertyData[6]),
            verificationVotes,
            rejectionVotes,
            valuationHistory: [],
            verificationHistory: [],
            transactionHistory: [],
            locationScore: 0,
            sizeScore: 0,
            conditionScore: 0,
            ageScore: 0,
            renovationScore: 0
          })

          index++
        } catch (err) {
          hasMore = false
        }
      }

      // Apply filters
      if (verifiedOnly) {
        properties = properties.filter(p => p.isVerified)
      }
      if (propertyType) {
        properties = properties.filter(p => p.propertyType === propertyType)
      }
      if (owner) {
        properties = properties.filter(p => p.currentOwner.toLowerCase() === owner.toLowerCase())
      }

      // Get total count after filtering
      const totalCount = properties.length

      // Apply pagination
      const startIndex = (page - 1) * limit
      properties = properties.slice(startIndex, startIndex + limit)

      const totalPages = Math.ceil(totalCount / limit)

      return {
        properties,
        totalCount,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    } catch (error) {
      console.error("Error getting properties with pagination:", error)
      throw error
    }
  }

  // get properties if connected and contracts are initialized
  useEffect(() => {
    if (isReady && propertyNFT && propertyValuation) {
      getPropertiesWithPagination({ page: 1, limit: 12 })
    }
  }, [isReady, propertyNFT, propertyValuation])

  // Check for existing connection on mount
  useEffect(() => {
    const initialize = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          
          if (accounts.length > 0) {
            // If already connected, just initialize contracts
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()
            const address = await signer.getAddress()
            
            setProvider(provider)
            setSigner(signer)
            setAddress(address)
            
            await initializeContracts(signer)
          }
        } catch (error) {
          console.error("Error checking accounts:", error)
        }
      }
    }

    initialize()

    // Add event listeners for wallet changes
    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected their wallet
        setProvider(null)
        setSigner(null)
        setAddress(null)
        setPropertyNFT(null)
        setPropertyValuation(null)
        toast.info("Wallet disconnected")
      } else {
        // User switched accounts
        const provider = new ethers.BrowserProvider(window.ethereum!)
        const signer = await provider.getSigner()
        const address = await signer.getAddress()
        
        setProvider(provider)
        setSigner(signer)
        setAddress(address)
        
        try {
          await initializeContracts(signer)
          toast.success(`Connected to ${address.slice(0, 6)}...${address.slice(-4)}`)
        } catch (error) {
          toast.error("Failed to initialize contracts with new account")
        }
      }
    }

    const handleChainChanged = () => {
      // Reload the page when the chain changes
      window.location.reload()
    }

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)
    }

    // Cleanup event listeners
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  // Submit vote
  const submitVote = async (tokenId: string, approve: boolean) => {
    if (!propertyNFT || !signer) {
      toast.error("Please connect your wallet first")
      return
    }

    try {
      setTransactionPending(true)
      setVotingProperty(tokenId)
      const tx = await propertyNFT.voteOnProperty(tokenId, approve)
      await tx.wait()
      toast.success(`Property ${approve ? 'approved' : 'rejected'} successfully`)
      
      // Refresh properties after voting
      await getPropertiesWithPagination({ page: 1, limit: 12 })
    } catch (error) {
      console.error("Error voting on property:", error)
      // Extract the error message from the revert reason
      const errorMessage = error instanceof Error && error.message.includes("reason=")
        ? error.message.split("reason=")[1].split(",")[0].replace(/"/g, "")
        : "Failed to submit vote"
      toast.error(errorMessage)
    } finally {
      setTransactionPending(false)
      setVotingProperty(null)
    }
  }

  const getProperty = async (tokenId: string): Promise<PropertyData> => {
    if (!propertyNFT) {
      throw new Error("Contract not initialized")
    }

    try {
      // Always fetch fresh data from the contract
      const propertyData = await propertyNFT.properties(tokenId)
      if (!propertyData[0] || propertyData[0] === "") {
        throw new Error("Property not found")
      }

      const owner = await propertyNFT.ownerOf(tokenId)
      const tokenURI = await propertyNFT.tokenURI(tokenId)
      const verificationVotes = BigInt(propertyData[9]?.toString() || "0")
      const rejectionVotes = BigInt(propertyData[10]?.toString() || "0")

      const property: PropertyData = {
        tokenId: BigInt(tokenId),
        propertyAddress: propertyData[0],
        ownerName: propertyData[1],
        propertyType: propertyData[2],
        renovationDate: BigInt(propertyData[3]),
        tokenURI: tokenURI || "",
        imageURI: propertyData[4] || "",
        isVerified: propertyData[7],
        estimatedValue: BigInt(propertyData[8]),
        currentOwner: owner,
        latitude: BigInt(propertyData[5]),
        longitude: BigInt(propertyData[6]),
        verificationVotes,
        rejectionVotes,
        valuationHistory: [],
        verificationHistory: [],
        transactionHistory: [],
        locationScore: 0,
        sizeScore: 0,
        conditionScore: 0,
        ageScore: 0,
        renovationScore: 0
      }

      // Convert IPFS URL to HTTP URL if needed
      let imageURI = property.imageURI
      if (imageURI.startsWith('ipfs://')) {
        const ipfsHash = imageURI.replace('ipfs://', '')
        // Use Pinata gateway for better reliability
        imageURI = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
      }

      // Parse tokenURI if it's base64 encoded
      interface AdditionalData {
        estimatedvalue?: number | string;
        latitude?: number | string;
        longitude?: number | string;
        renovationdate?: number | string;
        verificationvotes?: number | string;
        rejectionvotes?: number | string;
        verificationstatus?: string;
        [key: string]: any;
      }

      let additionalData: AdditionalData = {}
      if (property.tokenURI.startsWith('data:application/json;base64,')) {
        try {
          const base64Data = property.tokenURI.replace('data:application/json;base64,', '')
          const jsonData = JSON.parse(atob(base64Data))
          
          // Extract attributes from the JSON data
          const attributes = jsonData.attributes || []
          additionalData = attributes.reduce((acc: AdditionalData, attr: any) => {
            if (attr.trait_type && attr.value !== undefined) {
              acc[attr.trait_type.toLowerCase().replace(/\s+/g, '')] = attr.value
            }
            return acc
          }, {})
        } catch (error) {
          console.error('Error parsing tokenURI:', error)
        }
      }

      // Convert string values to BigInt
      const convertToBigInt = (value: string | number | bigint): bigint => {
        if (typeof value === 'bigint') return value
        if (typeof value === 'string') {
          // Remove any non-numeric characters except decimal point
          const cleanValue = value.replace(/[^0-9.]/g, '')
          // Convert to BigInt, handling decimal values
          return BigInt(Math.floor(parseFloat(cleanValue)))
        }
        return BigInt(value)
      }

      return {
        ...property,
        imageURI,
        // Use parsed data if available, otherwise use existing data
        estimatedValue: additionalData.estimatedvalue ? 
          convertToBigInt(additionalData.estimatedvalue) : 
          property.estimatedValue,
        latitude: additionalData.latitude ? 
          convertToBigInt(additionalData.latitude) : 
          property.latitude,
        longitude: additionalData.longitude ? 
          convertToBigInt(additionalData.longitude) : 
          property.longitude,
        renovationDate: additionalData.renovationdate ? 
          convertToBigInt(additionalData.renovationdate) : 
          property.renovationDate,
        verificationVotes: additionalData.verificationvotes ? 
          convertToBigInt(additionalData.verificationvotes) : 
          property.verificationVotes,
        rejectionVotes: additionalData.rejectionvotes ? 
          convertToBigInt(additionalData.rejectionvotes) : 
          property.rejectionVotes,
        isVerified: additionalData.verificationstatus === "Verified" || property.isVerified
      }
    } catch (error) {
      console.error("Error getting property:", error)
      throw error
    }
  }

  const estimateTransferGas = async (tokenId: string, to: string): Promise<bigint> => {
    if (!propertyNFT || !signer) {
      throw new Error("Contract not initialized")
    }

    try {
      const userAddress = await signer.getAddress()
      const contract = propertyNFT.connect(signer) as ethers.Contract & { 
        transferFrom: {
          (from: string, to: string, tokenId: string): Promise<ethers.ContractTransactionResponse>;
          estimateGas(from: string, to: string, tokenId: string): Promise<bigint>;
        }
      }
      return await contract.transferFrom.estimateGas(userAddress, to, tokenId)
    } catch (error) {
      console.error("Error estimating gas:", error)
      throw error
    }
  }

  const transferNFT = async (tokenId: string, to: string): Promise<ethers.ContractTransactionResponse> => {
    if (!propertyNFT || !signer) {
      throw new Error("Contract not initialized")
    }

    try {
      const userAddress = await signer.getAddress()
      const owner = await propertyNFT.ownerOf(tokenId)
      
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error("You are not the owner of this NFT")
      }

      const contract = propertyNFT.connect(signer) as ethers.Contract & { 
        transferFrom: {
          (from: string, to: string, tokenId: string): Promise<ethers.ContractTransactionResponse>;
          estimateGas(from: string, to: string, tokenId: string): Promise<bigint>;
        }
      }
      return await contract.transferFrom(userAddress, to, tokenId)
    } catch (error) {
      console.error("Error transferring NFT:", error)
      throw error
    }
  }

  // Vote on property valuation
  const voteOnValuation = async (tokenId: number, approve: boolean) => {
    await ensureReady()
    if (!propertyValuation) throw new Error("Valuation contract not initialized")
    
    return await propertyValuation.voteOnValuation(tokenId, approve)
  }

  // Check if user has voted on a pending valuation
  const hasUserVotedOnValuation = async (tokenId: number, userAddress?: string) => {
    await ensureReady()
    if (!propertyValuation) throw new Error("Valuation contract not initialized")
    
    const addressToCheck = userAddress || address
    if (!addressToCheck) return false
    
    try {
      return await propertyValuation.hasUserVotedOnPending(tokenId, addressToCheck)
    } catch (error) {
      console.error(`Error checking valuation vote status for token ${tokenId}:`, error)
      return false
    }
  }

  // Submit valuation vote with UI feedback
  const submitValuationVote = async (tokenId: string, approve: boolean) => {
    if (!propertyValuation || !signer) {
      toast.error("Please connect your wallet first")
      return
    }

    try {
      setTransactionPending(true)
      setVotingProperty(tokenId)
      
      const tx = await propertyValuation.voteOnValuation(Number(tokenId), approve)
      await tx.wait()
      
      toast.success(`Valuation ${approve ? 'approved' : 'rejected'} successfully`)
      
      // Refresh properties after voting
      await getPropertiesWithPagination({ page: 1, limit: 12 })
    } catch (error) {
      console.error("Error voting on valuation:", error)
      
      // Extract the error message from the revert reason
      const errorMessage = error instanceof Error && error.message.includes("reason=")
        ? error.message.split("reason=")[1].split(",")[0].replace(/"/g, "")
        : "Failed to submit valuation vote"
      toast.error(errorMessage)
    } finally {
      setTransactionPending(false)
      setVotingProperty(null)
    }
  }
  const confirmValuationUpdate = async (tokenId: number) => {
    await ensureReady()
    if (!propertyValuation) throw new Error("Valuation contract not initialized")
    
    try {
      return await propertyValuation.confirmValuationUpdate(tokenId)
    } catch (error) {
      console.error("Error confirming valuation update:", error)
      throw error
    }
  }

  // Check if the valuation contract is authorized to update property values
  const isContractAuthorized = async () => {
    await ensureReady()
    if (!propertyValuation) throw new Error("Valuation contract not initialized")
    
    try {
      return await propertyValuation.isAuthorizedToUpdate()
    } catch (error) {
      console.error("Error checking contract authorization:", error)
      return false
    }
  }

  return (
    <ContractContext.Provider
      value={{
        propertyNFT,
        propertyValuation,
        provider,
        signer,
        address,
        isReady,
        connect,
        submitProperty,
        voteOnProperty,
        submitValuation,
        getPropertiesWithPagination,
        submitVote,
        transactionPending,
        votingProperty,
        getProperty,
        transferNFT,
        estimateTransferGas,
        voteOnValuation,
        hasUserVotedOnValuation,
        submitValuationVote,
        confirmValuationUpdate,
        isContractAuthorized
      }}
    >
      {children}
    </ContractContext.Provider>
  )
}

export function useContract() {
  const context = useContext(ContractContext)
  if (!context) {
    throw new Error('useContract must be used within a ContractProvider')
  }
  return context
}