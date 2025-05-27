"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertTriangle, Wallet } from "lucide-react"
import contractArtifact from "../../build/contracts/PropertyNFT.json"
import valuationContractArtifact from "../../build/contracts/PropertyValuation.json"

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
  pendingValuation?: {
    value: bigint
    votes: {
      approve: number
      reject: number
    }
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

      const totalProperties = await contract.getTotalProperties()
      const propertiesData = []

      for (let i = 0; i < totalProperties; i++) {
        const propertyData = await contract.getProperty(i)
        const isVerified = propertyData.isVerified

        // Get token URI for the property
        const tokenURI = await contract.tokenURI(i)

        // Get the current timestamp if submittedDate is not available
        const timestamp = propertyData.submittedDate || Math.floor(Date.now() / 1000)
        const formattedDate = formatDate(timestamp)

        // Check if there's a pending valuation update
        const pendingValuation = await valuationContract.pendingValuations(i)
        const hasPendingValuation = pendingValuation && pendingValuation.estimatedValue > 0

        // Only show unverified properties or properties with pending valuations
        if (!isVerified || hasPendingValuation) {
          propertiesData.push({
            id: i.toString(),
            address: propertyData.propertyAddress,
            ownerName: propertyData.ownerName,
            propertyType: propertyData.propertyType,
            image: convertIPFStoHTTP(tokenURI),
            submittedDate: formattedDate,
            votes: {
              approve: Number(propertyData.approvalVotes) || 0,
              reject: Number(propertyData.rejectionVotes) || 0
            },
            isVerified,
            estimatedValue: propertyData.estimatedValue,
            isValuationUpdate: hasPendingValuation,
            pendingValuation: hasPendingValuation ? {
              value: pendingValuation.estimatedValue,
              votes: {
                approve: Number(pendingValuation.verificationVotes) || 0,
                reject: Number(pendingValuation.rejectionVotes) || 0
              }
            } : undefined
          })
        }
      }

      setProperties(propertiesData)
    } catch (err) {
      console.error("Error fetching properties:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch properties")
    } finally {
      setLoading(false)
    }
  }

  const submitVote = async (propertyId: string, approve: boolean) => {
    if (!walletConnected) {
      setError("Please connect your wallet to vote")
      return
    }

    setVotingProperty(propertyId)
    setTransactionPending(true)
    setTransactionSuccess(null)
    setError(null)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signer)
      const valuationContract = new ethers.Contract(VALUATION_CONTRACT_ADDRESS, valuationContractArtifact.abi, signer)

      // Get the property data to check if it's a valuation update
      const property = properties.find(p => p.id === propertyId)
      if (!property) {
        throw new Error("Property not found")
      }

      let tx
      if (property.isValuationUpdate) {
        // Vote on valuation update
        tx = await valuationContract.voteOnValuation(propertyId, approve)
      } else {
        // Vote on property verification
        tx = await contract.voteOnProperty(propertyId, approve)
      }

      await tx.wait()
      setTransactionSuccess(approve ? "approved" : "rejected")
      await fetchProperties() // Refresh the properties list
    } catch (err) {
      console.error("Error voting:", err)
      setError(err instanceof Error ? err.message : "Failed to submit vote")
    } finally {
      setTransactionPending(false)
    }
  }

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending Verification</TabsTrigger>
          <TabsTrigger value="valuation">Valuation Updates</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {properties.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No properties pending verification</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {properties.map((property) => (
                <Card key={property.id} className="relative">
                  {property.isValuationUpdate && (
                    <Badge className="absolute top-2 right-2 bg-yellow-500">Valuation Update</Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{property.address}</CardTitle>
                    <CardDescription>
                      Submitted by {property.ownerName} on {property.submittedDate}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-[200px] h-[200px] mx-auto mb-4">
                      <img
                        src={property.image}
                        alt={property.address}
                        className="object-cover w-full h-full rounded-lg"
                        onError={(e) => {
                          console.log("Image failed to load:", property.image)
                          e.currentTarget.src = "/placeholder.svg?height=200&width=200"
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Property Type</span>
                        <Badge variant="outline">{property.propertyType}</Badge>
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
                          <Badge variant="outline" className="bg-green-100">
                            Approve: {property.isValuationUpdate ? property.pendingValuation?.votes.approve : property.votes.approve}
                          </Badge>
                          <Badge variant="outline" className="bg-red-100">
                            Reject: {property.isValuationUpdate ? property.pendingValuation?.votes.reject : property.votes.reject}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => submitVote(property.id, false)}
                        disabled={!walletConnected}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => submitVote(property.id, true)}
                        disabled={!walletConnected}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="valuation" className="mt-6">
          {properties.filter(p => p.isValuationUpdate).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No valuation updates pending verification</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.filter(p => p.isValuationUpdate).map((property) => (
                <Card key={property.id} className="relative">
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{property.address}</CardTitle>
                    <CardDescription>
                      Valuation update by {property.ownerName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-[200px] h-[200px] mx-auto mb-4">
                      <img
                        src={property.image}
                        alt={property.address}
                        className="object-cover w-full h-full rounded-lg"
                        onError={(e) => {
                          console.log("Image failed to load:", property.image)
                          e.currentTarget.src = "/placeholder.svg?height=200&width=200"
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Current Value</span>
                        <span className="text-sm font-semibold">
                          {ethers.formatEther(property.estimatedValue?.toString() || "0")} ETH
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">New Value</span>
                        <span className="text-sm font-semibold">
                          {ethers.formatEther(property.pendingValuation?.value.toString() || "0")} ETH
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Votes</span>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-green-100">
                            Approve: {property.pendingValuation?.votes.approve}
                          </Badge>
                          <Badge variant="outline" className="bg-red-100">
                            Reject: {property.pendingValuation?.votes.reject}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => submitVote(property.id, false)}
                        disabled={!walletConnected}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => submitVote(property.id, true)}
                        disabled={!walletConnected}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Approved properties will appear here</p>
          </div>
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Rejected properties will appear here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
