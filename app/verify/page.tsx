"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertTriangle, Wallet, Check, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import contractArtifact from "../../build/contracts/PropertyNFT.json"
import valuationContractArtifact from "../../build/contracts/PropertyValuation.json"
import { toast } from "sonner"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""
const VALUATION_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_VALUATION_ADDRESS || ""

// Format timestamp to date string
const formatDate = (timestamp: string | number | bigint) => {
  console.log("Raw timestamp:", timestamp)
  try {
    if (!timestamp) {
      console.log("No timestamp provided")
      return 'Unknown'
    }
    const timestampNumber = Number(timestamp)
    console.log("Converted timestamp number:", timestampNumber)
    if (isNaN(timestampNumber)) {
      console.log("Invalid timestamp number")
      return 'Unknown'
    }
    const date = new Date(timestampNumber * 1000)
    console.log("Created date object:", date)
    if (isNaN(date.getTime())) {
      console.log("Invalid date object")
      return 'Unknown'
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    console.error("Error formatting date:", error)
    return 'Unknown'
  }
}

// Convert IPFS URL to HTTP URL
const convertIPFStoHTTP = (ipfsUrl: string) => {
  console.log("Original IPFS URL:", ipfsUrl)
  if (!ipfsUrl) {
    console.log("No IPFS URL provided, using placeholder")
    return "/placeholder.svg?height=200&width=300"
  }
  if (ipfsUrl.startsWith("ipfs://")) {
    const httpUrl = `https://ipfs.io/ipfs/${ipfsUrl.replace("ipfs://", "")}`
    console.log("Converted to HTTP URL:", httpUrl)
    return httpUrl
  }
  // If it's not an IPFS URL, try to parse it as a JSON string
  try {
    const jsonData = JSON.parse(ipfsUrl)
    if (jsonData.image) {
      return convertIPFStoHTTP(jsonData.image)
    }
  } catch (e) {
    console.log("Not a JSON string, using as is")
  }
  console.log("Using original URL:", ipfsUrl)
  return ipfsUrl
}

interface Property {
  id: string
  address: string
  ownerName: string
  propertyType: string
  image: string
  submittedDate: string
  votes: {
    approve: number
    reject: number
  }
  isVerified: boolean
  estimatedValue?: bigint
  isValuationUpdate?: boolean
  owner: string
  pendingValuation?: {
    value: bigint
    votes: {
      approve: number
      reject: number
    }
    isVerified: boolean
  }
}

export default function VerifyPage() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [votingProperty, setVotingProperty] = useState<string | null>(null)
  const [transactionPending, setTransactionPending] = useState(false)
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check wallet connection on mount
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
          const signer = await provider.getSigner()
          const address = await signer.getAddress()
          setWalletConnected(true)
          setWalletAddress(address)
          await fetchProperties()
        } catch (err) {
          console.error("Error checking wallet connection:", err)
        }
      }
    }

    checkWalletConnection()
  }, [])

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setWalletConnected(false)
          setWalletAddress("")
          setProperties([])
        } else {
          setWalletConnected(true)
          setWalletAddress(accounts[0])
          fetchProperties()
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        }
      }
    }
  }, [])

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to view properties")
      }

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setWalletConnected(true)
      setWalletAddress(address)
      await fetchProperties()
    } catch (err) {
      console.error("Error connecting wallet:", err)
      setError(err instanceof Error ? err.message : "Failed to connect wallet")
    } finally {
      setIsConnecting(false)
    }
  }

  const fetchProperties = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to view properties")
      }

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, provider)
      const valuationContract = new ethers.Contract(VALUATION_CONTRACT_ADDRESS, valuationContractArtifact.abi, provider)

      // Get total number of properties
      const totalProperties = await contract.getTotalProperties()
      const propertiesData = []

      for (let i = 0; i < totalProperties; i++) {
        const propertyData = await contract.getProperty(i)
        const isVerified = propertyData.isVerified

        // Get token URI for the property
        const tokenURI = await contract.tokenURI(i)

        // Get the current timestamp if submittedDate is not available
        const timestamp = propertyData.submissionDate || Math.floor(Date.now() / 1000)
        const formattedDate = formatDate(timestamp)

        // Get property owner
        const owner = await contract.ownerOf(i)

        // Check if there's a pending valuation update
        const pendingValuation = await valuationContract.pendingValuations(i)
        const hasPendingValuation = pendingValuation && pendingValuation.estimatedValue > 0

        // Get historical values
        const historicalValues = await valuationContract.getHistoricalValues(i)
        const hasHistoricalValues = historicalValues && historicalValues.length > 0

        propertiesData.push({
          id: i.toString(),
          address: propertyData.propertyAddress,
          ownerName: propertyData.ownerName,
          propertyType: propertyData.propertyType,
          image: convertIPFStoHTTP(tokenURI),
          submittedDate: formattedDate,
          votes: {
            approve: Number(propertyData.verificationVotes) || 0,
            reject: Number(propertyData.rejectionVotes) || 0
          },
          isVerified,
          estimatedValue: propertyData.estimatedValue,
          isValuationUpdate: hasPendingValuation || hasHistoricalValues,
          owner: owner,
          pendingValuation: hasPendingValuation ? {
            value: pendingValuation.estimatedValue,
            votes: {
              approve: Number(pendingValuation.verificationVotes) || 0,
              reject: Number(pendingValuation.rejectionVotes) || 0
            },
            isVerified: pendingValuation.verificationVotes >= 3
          } : undefined
        })
      }

      console.log("Fetched properties data:", propertiesData)
      setProperties(propertiesData)
    } catch (err) {
      console.error("Error fetching properties:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch properties")
    } finally {
      setLoading(false)
    }
  }

  const submitVote = async (tokenId: string, approve: boolean) => {
    if (!walletConnected) {
      toast.error("Please connect your wallet first")
      return
    }

    try {
      setTransactionPending(true)
      setTransactionSuccess(null)

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const nftContract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signer)
      const valuationContract = new ethers.Contract(VALUATION_CONTRACT_ADDRESS, valuationContractArtifact.abi, signer)

      // Check if user is the property owner
      const propertyOwner = await nftContract.ownerOf(tokenId)
      if (propertyOwner.toLowerCase() === walletAddress.toLowerCase()) {
        throw new Error("Property owners cannot vote on their own properties")
      }

      // Find the property in our state
      const property = properties.find(p => p.id === tokenId)
      if (!property) {
        throw new Error("Property not found")
      }

      // Handle valuation updates
      if (property.isValuationUpdate) {
        // Check for pending valuation
        let pendingValuation
        try {
          pendingValuation = await valuationContract.getPendingValuation(tokenId)
          if (!pendingValuation || pendingValuation.estimatedValue === BigInt(0)) {
            throw new Error("No pending valuation update found")
          }
        } catch (error) {
          console.error("Error checking pending valuation:", error)
          throw new Error("Failed to check pending valuation: " + (error as Error).message)
        }

        // Check if user has already voted
        const hasVoted = await valuationContract.pendingValuationVotes(tokenId, walletAddress)
        if (hasVoted) {
          throw new Error("You have already voted on this valuation")
        }

        // Check if valuation is already verified
        if (pendingValuation.isVerified) {
          throw new Error("This valuation has already been verified")
        }

        // Execute vote on valuation
        const tx = await valuationContract.voteOnValuation(tokenId, approve)
        await tx.wait()
      } else {
        // Handle regular property verification
        // Check if user has already voted
        const hasVoted = await nftContract.hasUserVoted(tokenId, walletAddress)
        if (hasVoted) {
          throw new Error("You have already voted on this property")
        }

        // Check if property is already verified
        const propertyData = await nftContract.getProperty(tokenId)
        if (propertyData.isVerified) {
          throw new Error("This property has already been verified")
        }

        // Execute vote on property
        const tx = await nftContract.voteOnProperty(tokenId, approve)
        await tx.wait()
      }

      setTransactionSuccess("voted")
      toast.success("Vote submitted successfully")
      await fetchProperties() // Refresh list
    } catch (error) {
      console.error("Error voting:", error)
      setTransactionPending(false)
      toast.error((error as Error).message || "Failed to submit vote")
    }
  }

  const confirmValuationUpdate = async (propertyId: string) => {
    if (!walletConnected) {
      setError("Please connect your wallet to confirm valuation")
      return
    }

    setVotingProperty(propertyId)
    setTransactionPending(true)
    setTransactionSuccess(null)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const valuationContract = new ethers.Contract(VALUATION_CONTRACT_ADDRESS, valuationContractArtifact.abi, signer)

      // Convert propertyId to number
      const propertyIdNum = parseInt(propertyId)
      if (isNaN(propertyIdNum)) {
        throw new Error("Invalid property ID")
      }

      console.log("Before confirmation - Property state:", properties.find(p => p.id === propertyId))

      // Confirm the valuation update
      const tx = await valuationContract.confirmValuationUpdate(propertyIdNum)
      await tx.wait()

      // Fetch fresh data after confirmation
      await fetchProperties()

      setTransactionSuccess("confirmed")
      toast.success("Valuation update confirmed successfully")
    } catch (err) {
      console.error("Error confirming valuation:", err)
      setError(err instanceof Error ? err.message : "Failed to confirm valuation")
      toast.error("Failed to confirm valuation")
    } finally {
      setTransactionPending(false)
      setVotingProperty(null)
    }
  }

  // Add debug logs for tab filtering
  const pendingValuationUpdates = properties.filter(p => p.isValuationUpdate && !p.pendingValuation?.isVerified)
  const approvedProperties = properties.filter(p => (p.isVerified && !p.isValuationUpdate) || (p.isValuationUpdate && p.pendingValuation?.isVerified))

  // Add count calculations for each tab
  const pendingCount = properties.filter(p => !p.isVerified && !p.isValuationUpdate).length
  const valuationCount = properties.filter(p => p.isValuationUpdate && p.pendingValuation && !p.pendingValuation.isVerified).length
  const approvedCount = properties.filter(p => p.isVerified && !p.isValuationUpdate).length
  const rejectedCount = 0 // Since we don't have rejected properties yet
  const valuedCount = properties.filter(p => p.isValuationUpdate && p.isVerified && (!p.pendingValuation || p.pendingValuation.isVerified)).length

  console.log("Properties state:", properties)
  console.log("Pending valuation updates:", pendingValuationUpdates)
  console.log("Approved properties:", approvedProperties)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Community Verification</h1>

        {!walletConnected ? (
          <Button onClick={connectWallet} disabled={isConnecting}>
            {isConnecting ? (
              <>Connecting Wallet...</>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect MetaMask
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center">
            <Badge variant="outline" className="mr-2">
              Connected: {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'No Address'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setWalletConnected(false)}>
              Disconnect
            </Button>
          </div>
        )}
      </div>

      {!walletConnected && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connect your wallet</AlertTitle>
          <AlertDescription>
            You need to connect your Ethereum wallet to participate in property verification.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending" className="relative">
            Pending Verification
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="valuation" className="relative">
            Valuation Updates
            {valuationCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-200">
                {valuationCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="relative">
            Approved
            {approvedCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 hover:bg-green-200">
                {approvedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="relative">
            Rejected
            {rejectedCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-red-100 text-red-800 hover:bg-red-200">
                {rejectedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="valued" className="relative">
            Valued Properties
            {valuedCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-800 hover:bg-purple-200">
                {valuedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {properties.filter(p => !p.isVerified && !p.isValuationUpdate).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No properties pending verification</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.filter(p => !p.isVerified && !p.isValuationUpdate).map((property) => (
                <Card key={property.id} className="relative overflow-hidden">
                  {property.isValuationUpdate && (
                    <Badge className="absolute top-2 right-2 bg-yellow-500 hover:bg-yellow-600">Valuation Update</Badge>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-1 text-lg">{property.address}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span>By {property.ownerName}</span>
                      <span>•</span>
                      <span>{property.submittedDate}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={property.image}
                        alt={property.address}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          console.log("Image failed to load:", property.image)
                          e.currentTarget.src = "/placeholder.svg?height=400&width=400"
                        }}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Property Type</span>
                        <Badge variant="secondary">{property.propertyType}</Badge>
                      </div>
                      {property.isValuationUpdate && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">New Valuation</span>
                          <span className="text-sm font-semibold">
                            {ethers.formatEther(property.pendingValuation?.value.toString() || "0")} ETH
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Votes</span>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Approve: {property.isValuationUpdate ? property.pendingValuation?.votes.approve : property.votes.approve}
                          </Badge>
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Reject: {property.isValuationUpdate ? property.pendingValuation?.votes.reject : property.votes.reject}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center">
                    {property.isValuationUpdate ? (
                      // Show vote buttons if not verified
                      <div className="flex gap-2 w-full">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => submitVote(property.id, false)}
                          disabled={transactionPending && votingProperty === property.id}
                        >
                          {transactionPending && votingProperty === property.id ? (
                            <>Voting...</>
                          ) : (
                            <>Reject</>
                          )}
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => submitVote(property.id, true)}
                          disabled={transactionPending && votingProperty === property.id}
                        >
                          {transactionPending && votingProperty === property.id ? (
                            <>Voting...</>
                          ) : (
                            <>Approve</>
                          )}
                        </Button>
                      </div>
                    ) : (
                      // Original property verification buttons
                      <div className="flex gap-2 w-full">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => submitVote(property.id, false)}
                          disabled={transactionPending && votingProperty === property.id}
                        >
                          {transactionPending && votingProperty === property.id ? (
                            <>Voting...</>
                          ) : (
                            <>Reject</>
                          )}
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => submitVote(property.id, true)}
                          disabled={transactionPending && votingProperty === property.id}
                        >
                          {transactionPending && votingProperty === property.id ? (
                            <>Voting...</>
                          ) : (
                            <>Approve</>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="valuation" className="mt-6">
          {properties.filter(p => p.isValuationUpdate && p.pendingValuation && !p.pendingValuation.isVerified).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No valuation updates pending verification</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.filter(p => p.isValuationUpdate && p.pendingValuation && !p.pendingValuation.isVerified).map((property) => (
                <Card key={property.id} className="relative overflow-hidden">
                  {property.pendingValuation?.isVerified && (
                    <Badge className="absolute top-2 right-2 bg-green-500 hover:bg-green-600">Verified</Badge>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-1 text-lg">{property.address}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span>By {property.ownerName}</span>
                      <span>•</span>
                      <span>{property.submittedDate}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={property.image}
                        alt={property.address}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          console.log("Image failed to load:", property.image)
                          e.currentTarget.src = "/placeholder.svg?height=400&width=400"
                        }}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Current Value</span>
                        <span className="text-sm font-semibold">
                          {ethers.formatEther(property.estimatedValue?.toString() || "0")} ETH
                        </span>
                      </div>
                      {property.pendingValuation && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">New Value</span>
                          <span className="text-sm font-semibold">
                            {ethers.formatEther(property.pendingValuation.value.toString() || "0")} ETH
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Votes</span>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Approve: {property.pendingValuation?.votes.approve || 0}
                          </Badge>
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Reject: {property.pendingValuation?.votes.reject || 0}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    {property.pendingValuation?.isVerified ? (
                      // Show confirm button for property owner when valuation is verified
                      (() => {
                        console.log("Property owner:", property.owner)
                        console.log("Wallet address:", walletAddress)
                        console.log("Is owner:", property.owner && walletAddress && property.owner.toLowerCase() === walletAddress.toLowerCase())
                        return property.owner && walletAddress && property.owner.toLowerCase() === walletAddress.toLowerCase() ? (
                          <Button
                            onClick={() => confirmValuationUpdate(property.id)}
                            disabled={transactionPending && votingProperty === property.id}
                            className="w-full"
                          >
                            {transactionPending && votingProperty === property.id ? (
                              <>Confirming...</>
                            ) : (
                              <>Confirm Valuation Update</>
                            )}
                          </Button>
                        ) : (
                          <div className="text-sm text-muted-foreground w-full text-center">
                            Waiting for owner to confirm the update
                          </div>
                        )
                      })()
                    ) : (
                      // Show vote buttons if not verified
                      <div className="flex gap-2 w-full">
                        <Button
                          variant="outline"
                          className="flex-1 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                          onClick={() => submitVote(property.id, false)}
                          disabled={!walletConnected || (transactionPending && votingProperty === property.id)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          {transactionPending && votingProperty === property.id ? "Voting..." : "Reject"}
                        </Button>
                        <Button
                          className="flex-1 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                          onClick={() => submitVote(property.id, true)}
                          disabled={!walletConnected || (transactionPending && votingProperty === property.id)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {transactionPending && votingProperty === property.id ? "Voting..." : "Approve"}
                        </Button>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          {approvedProperties.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No approved properties</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {approvedProperties.map((property) => (
                <Card key={property.id} className="relative overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-1 text-lg">{property.address}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span>By {property.ownerName}</span>
                      <span>•</span>
                      <span>{property.submittedDate}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={property.image}
                        alt={property.address}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          console.log("Image failed to load:", property.image)
                          e.currentTarget.src = "/placeholder.svg?height=400&width=400"
                        }}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Property Type</span>
                        <Badge variant="secondary">{property.propertyType}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Current Value</span>
                        <span className="text-sm font-semibold">
                          {ethers.formatEther(property.estimatedValue?.toString() || "0")} ETH
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Rejected properties will appear here</p>
          </div>
        </TabsContent>

        <TabsContent value="valued" className="mt-6">
          {properties.filter(p => p.isValuationUpdate && p.isVerified && (!p.pendingValuation || p.pendingValuation.isVerified)).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No properties with confirmed valuations</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.filter(p => p.isValuationUpdate && p.isVerified && (!p.pendingValuation || p.pendingValuation.isVerified)).map((property) => (
                <Card key={property.id} className="relative overflow-hidden">
                  <Badge className="absolute top-2 right-2 bg-green-500 hover:bg-green-600">Valuation Confirmed</Badge>
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-1 text-lg">{property.address}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span>By {property.ownerName}</span>
                      <span>•</span>
                      <span>{property.submittedDate}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={property.image}
                        alt={property.address}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          console.log("Image failed to load:", property.image)
                          e.currentTarget.src = "/placeholder.svg?height=400&width=400"
                        }}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Property Type</span>
                        <Badge variant="secondary">{property.propertyType}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Current Value</span>
                        <span className="text-sm font-semibold">
                          {ethers.formatEther(property.estimatedValue?.toString() || "0")} ETH
                        </span>
                      </div>
                      {property.pendingValuation && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">New Value</span>
                          <span className="text-sm font-semibold">
                            {ethers.formatEther(property.pendingValuation.value.toString() || "0")} ETH
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Votes</span>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Approve: {property.pendingValuation?.votes.approve || 0}
                          </Badge>
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Reject: {property.pendingValuation?.votes.reject || 0}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    {property.owner && walletAddress && property.owner.toLowerCase() === walletAddress.toLowerCase() ? (
                      <Button
                        onClick={() => confirmValuationUpdate(property.id)}
                        disabled={transactionPending && votingProperty === property.id}
                        className="w-full"
                      >
                        {transactionPending && votingProperty === property.id ? (
                          <>Confirming...</>
                        ) : (
                          <>Confirm Valuation Update</>
                        )}
                      </Button>
                    ) : (
                      <div className="text-sm text-muted-foreground w-full text-center">
                        Waiting for owner to confirm the update
                      </div>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
