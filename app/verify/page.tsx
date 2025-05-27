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

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""

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

      const totalProperties = await contract.getTotalProperties()
      const propertiesData = []

      for (let i = 0; i < totalProperties; i++) {
        const propertyData = await contract.getProperty(i)
        console.log("Property data:", propertyData)
        const isVerified = propertyData.isVerified

        // Only show unverified properties in the pending tab
        if (!isVerified) {
          // Get token URI for the property
          const tokenURI = await contract.tokenURI(i)
          console.log("Fetched tokenURI:", tokenURI)

          // Get the current timestamp if submittedDate is not available
          const timestamp = propertyData.submittedDate || Math.floor(Date.now() / 1000)
          const formattedDate = formatDate(timestamp)
          console.log("Formatted date:", formattedDate)

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
            isVerified
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
    if (!walletConnected) return

    setVotingProperty(propertyId)
    setTransactionPending(true)
    setError(null)

    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to vote")
      }

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signer)

      const tx = await contract.voteOnProperty(propertyId, approve)
      await tx.wait()

      setTransactionSuccess(approve ? "approved" : "rejected")
      await fetchProperties() // Refresh the properties list

      // Reset after showing success message
      setTimeout(() => {
        setTransactionSuccess(null)
        setVotingProperty(null)
        setTransactionPending(false)
      }, 3000)
    } catch (err) {
      console.error("Error submitting vote:", err)
      setError(err instanceof Error ? err.message : "Failed to submit vote")
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pending Verification</TabsTrigger>
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
                <Card key={property.id}>
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/3">
                      <img
                        src={property.image}
                        alt={property.address}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.log("Image failed to load:", property.image)
                          e.currentTarget.src = "/placeholder.svg?height=200&width=300"
                        }}
                      />
                    </div>
                    <div className="md:w-2/3">
                      <CardHeader>
                        <CardTitle className="text-lg">{property.address}</CardTitle>
                        <CardDescription>{property.propertyType}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Owner</p>
                          <p>{property.ownerName || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                          <p>{property.submittedDate || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Current Votes</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <div className="flex items-center">
                              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              <span>{property.votes.approve.toString()}</span>
                            </div>
                            <div className="flex items-center">
                              <XCircle className="h-4 w-4 text-red-500 mr-1" />
                              <span>{property.votes.reject.toString()}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        {votingProperty === property.id && transactionPending ? (
                          <Button disabled className="w-full">
                            Processing Transaction...
                          </Button>
                        ) : votingProperty === property.id && transactionSuccess ? (
                          <Button disabled className="w-full bg-green-500 hover:bg-green-500">
                            {transactionSuccess === "approved" ? "Approved!" : "Rejected!"}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 mr-2"
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
                          </>
                        )}
                      </CardFooter>
                    </div>
                  </div>
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
