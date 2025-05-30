"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ethers } from "ethers"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Share2, ArrowRight, ExternalLink, PlusCircle, ArrowLeft, CheckCircle, XCircle, TrendingUp, MapPin, Calendar, DollarSign, Users, Clock, ThumbsUp, ThumbsDown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { useContract } from "../../contexts/ContractProvider"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""

const NZ_PROPERTY_TYPES = {
  "HOUSE": "House",
  "APARTMENT": "Apartment", 
  "TOWNHOUSE": "Townhouse",
  "UNIT": "Unit",
  "VILLA": "Villa",
  "BUNGALOW": "Bungalow",
  "TERRACE": "Terrace House",
  "SECTION": "Section/Land",
  "COMMERCIAL": "Commercial",
  "RURAL": "Rural Property",
  "LIFESTYLE": "Lifestyle Block",
  "BACH": "Bach/Holiday Home"
} as const

interface PropertyData {
  tokenId: bigint
  propertyAddress: string
  ownerName: string
  propertyType: string
  renovationDate: bigint
  tokenURI: string
  imageURI: string
  isVerified: boolean
  estimatedValue: bigint
  currentOwner: string
  latitude: bigint
  longitude: bigint
  verificationVotes: bigint
  rejectionVotes: bigint
  locationScore: number
  sizeScore: number
  conditionScore: number
  ageScore: number
  renovationScore: number
  hasVoted?: boolean
}

interface ValuationData {
  estimatedValue: bigint
  comparableValue: bigint
  lastUpdated: bigint
  locationScore: number
  sizeScore: number
  conditionScore: number
  ageScore: number
  renovationScore: number
  isVerified: boolean
  verificationVotes: number
  rejectionVotes: number
}

interface PendingValuationData {
  estimatedValue: bigint
  comparableValue: bigint
  lastUpdated: bigint
  locationScore: number
  sizeScore: number
  conditionScore: number
  ageScore: number
  renovationScore: number
  isVerified: boolean
  verificationVotes: number
  rejectionVotes: number
}

interface TransferDetails {
  recipient: string
  gasEstimate: string
  isENS: boolean
  ensName?: string
}

// Format currency in NZD
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value)
}

// Convert Wei to NZD (assuming 1 ETH = 500,000 NZD for demo)
const weiToNZD = (wei: bigint) => {
  const ethValue = Number(ethers.formatEther(wei))
  return ethValue * 500000
}

export default function NFTDetailPage() {
  const params = useParams()
  const tokenId = params.tokenId as string
  
  const { 
    getProperty, 
    transferNFT, 
    submitVote, 
    submitValuationVote,
    transactionPending, 
    votingProperty, 
    connect, 
    estimateTransferGas,
    propertyValuation,
    address,
    isReady
  } = useContract()

  const [property, setProperty] = useState<PropertyData | null>(null)
  const [valuationData, setValuationData] = useState<ValuationData | null>(null)
  const [pendingValuation, setPendingValuation] = useState<PendingValuationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [transferAddress, setTransferAddress] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferDetails, setTransferDetails] = useState<TransferDetails | null>(null)

  const refreshProperty = async () => {
    if (!isReady) return
    
    setError(null)
    setLoading(true)
    
    try {
      if (tokenId === undefined || tokenId === null) {
        throw new Error("Invalid token ID")
      }

      // Get property data
      const propertyData = await getProperty(tokenId)
      setProperty(propertyData)
      setImageUrl(propertyData.imageURI.startsWith('ipfs://') 
        ? propertyData.imageURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
        : propertyData.imageURI
      )

      // Get valuation data if available
      if (propertyValuation) {
        try {
          const verifiedValuation = await propertyValuation.getValuation(Number(tokenId))
          if (verifiedValuation && verifiedValuation[8]) { // isVerified
            setValuationData({
              estimatedValue: verifiedValuation[0],
              comparableValue: verifiedValuation[1],
              lastUpdated: verifiedValuation[2],
              locationScore: Number(verifiedValuation[3]),
              sizeScore: Number(verifiedValuation[4]),
              conditionScore: Number(verifiedValuation[5]),
              ageScore: Number(verifiedValuation[6]),
              renovationScore: Number(verifiedValuation[7]),
              isVerified: verifiedValuation[8],
              verificationVotes: Number(verifiedValuation[9]),
              rejectionVotes: Number(verifiedValuation[10])
            })
          }
        } catch (error) {
          console.log("No verified valuation found")
        }

        // Get pending valuation
        try {
          const pendingVal = await propertyValuation.getPendingValuation(Number(tokenId))
          if (pendingVal && Number(pendingVal.estimatedValue) > 0) {
            setPendingValuation({
              estimatedValue: pendingVal.estimatedValue,
              comparableValue: pendingVal.comparableValue,
              lastUpdated: pendingVal.lastUpdated,
              locationScore: Number(pendingVal.locationScore),
              sizeScore: Number(pendingVal.sizeScore),
              conditionScore: Number(pendingVal.conditionScore),
              ageScore: Number(pendingVal.ageScore),
              renovationScore: Number(pendingVal.renovationScore),
              isVerified: pendingVal.isVerified,
              verificationVotes: Number(pendingVal.verificationVotes),
              rejectionVotes: Number(pendingVal.rejectionVotes)
            })
          }
        } catch (error) {
          console.log("No pending valuation found")
        }
      }
      
    } catch (err) {
      console.error("Error fetching property data:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch property data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isReady) {
      refreshProperty()
    }
  }, [tokenId, isReady])

  useEffect(() => {
    if (!transactionPending && votingProperty === tokenId) {
      refreshProperty()
    }
  }, [transactionPending, votingProperty])

  const handleAddressChange = async (address: string) => {
    setTransferAddress(address)
    setTransferDetails(null)

    if (!address) return

    try {
      let resolvedAddress = address
      let isENS = false
      let ensName: string | undefined

      // Check if input is ENS name
      if (address.endsWith('.eth')) {
        const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
        const resolved = await provider.resolveName(address)
        if (resolved) {
          resolvedAddress = resolved
          isENS = true
          ensName = address
        }
      }

      if (!resolvedAddress || !ethers.isAddress(resolvedAddress)) {
        return
      }

      const gasEstimate = await estimateTransferGas(tokenId, resolvedAddress)
      setTransferDetails({
        recipient: resolvedAddress,
        gasEstimate: ethers.formatEther(gasEstimate),
        isENS,
        ensName,
      })
    } catch (err) {
      console.error("Error processing address:", err)
    }
  }

  const handleTransfer = async () => {
    if (!transferDetails) {
      toast.error("Please enter a valid Ethereum address")
      return
    }

    try {
      setIsTransferring(true)
      const tx = await transferNFT(tokenId, transferDetails.recipient)
      toast.promise(tx.wait(), {
        loading: "Transferring NFT...",
        success: "NFT transferred successfully!",
        error: "Failed to transfer NFT",
      })

      setIsTransferModalOpen(false)
      setTransferAddress("")
      setTransferDetails(null)
      await refreshProperty()
    } catch (err) {
      console.error("Error transferring NFT:", err)
      toast.error(err instanceof Error ? err.message : "Failed to transfer NFT")
    } finally {
      setIsTransferring(false)
    }
  }

  const handleValuationVote = async (approve: boolean) => {
    try {
      await submitValuationVote(tokenId, approve)
      await refreshProperty()
    } catch (err) {
      console.error("Error voting on valuation:", err)
    }
  }

  // Generate mock historical data for visualization
  const generateHistoricalData = (currentValue: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.map((month, index) => ({
      month,
      value: currentValue * (0.95 + Math.random() * 0.1) // ±5% variation
    }))
  }

  if (!isReady) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center py-8">
          <Button onClick={connect}>Connect Wallet</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error === "Property not found" ? (
            <>
              <h2 className="font-bold mb-2">Property Not Found</h2>
              <p>The property you're looking for doesn't exist or has been removed.</p>
            </>
          ) : error === "Contract not initialized" ? (
            <>
              <h2 className="font-bold mb-2">Wallet Not Connected</h2>
              <p>Please connect your wallet to view property details.</p>
            </>
          ) : (
            error
          )}
        </div>
        <Link href="/nft">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
        </Link>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Property not found
        </div>
      </div>
    )
  }

  const currentValue = valuationData ? weiToNZD(valuationData.estimatedValue) : weiToNZD(property.estimatedValue)
  const historicalData = generateHistoricalData(currentValue)

  return (
    <div className="max-w-6xl mx-auto p-4">
      <Link href="/nft">
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Property Image and Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Property Image */}
          <Card>
            <CardContent className="p-0">
              <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Property at ${property.propertyAddress}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-property.jpg';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500">No image available</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Property Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Badge 
                  variant={property.isVerified ? "default" : "secondary"}
                  className="text-sm px-3 py-1"
                >
                  {property.isVerified ? "✓ Verified" : "Pending Verification"}
                </Badge>
                {!property.isVerified && (
                  <div className="text-sm text-gray-500">
                    {Number(property.verificationVotes)}/3 votes
                  </div>
                )}
              </div>

              {!property.isVerified && (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Approval Progress</span>
                    <span>{Number(property.verificationVotes)}/3</span>
                  </div>
                  <Progress value={(Number(property.verificationVotes) / 3) * 100} className="mb-4" />
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 hover:bg-red-50 hover:text-red-700"
                      onClick={() => submitVote(tokenId, false)}
                      disabled={transactionPending}
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Reject ({Number(property.rejectionVotes)})
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 hover:bg-green-50 hover:text-green-700"
                      onClick={() => submitVote(tokenId, true)}
                      disabled={transactionPending}
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Approve ({Number(property.verificationVotes)})
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.open(`https://maps.google.com/?q=${Number(property.latitude) / 1000000},${Number(property.longitude) / 1000000}`, '_blank')}
              >
                <MapPin className="mr-2 h-4 w-4" />
                View on Map
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.open(`https://sepolia.etherscan.io/token/${CONTRACT_ADDRESS}?a=${tokenId}`, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Etherscan
              </Button>
              <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full justify-start">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Transfer NFT
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Transfer NFT</DialogTitle>
                    <DialogDescription>
                      Enter the recipient's Ethereum address or ENS name to transfer this NFT.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="address">Recipient Address or ENS Name</Label>
                      <Input
                        id="address"
                        placeholder="0x... or name.eth"
                        value={transferAddress}
                        onChange={(e) => handleAddressChange(e.target.value)}
                      />
                    </div>

                    {transferDetails && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Transfer Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <h3 className="font-semibold">Recipient</h3>
                            <div className="flex items-center gap-2">
                              <p className="text-gray-600 break-all text-sm">
                                {transferDetails.isENS ? (
                                  <>
                                    {transferDetails.ensName}
                                    <span className="text-xs text-gray-400 block">
                                      {transferDetails.recipient}
                                    </span>
                                  </>
                                ) : (
                                  transferDetails.recipient
                                )}
                              </p>
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold">Estimated Gas Cost</h3>
                            <p className="text-gray-600">{transferDetails.gasEstimate} ETH</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsTransferModalOpen(false)
                        setTransferAddress("")
                        setTransferDetails(null)
                      }}
                      disabled={isTransferring}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleTransfer} 
                      disabled={isTransferring || !transferDetails}
                    >
                      {isTransferring ? "Transferring..." : "Transfer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Detailed Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Header */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl mb-2">Property #{tokenId}</CardTitle>
                  <CardDescription className="text-base">{property.propertyAddress}</CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {NZ_PROPERTY_TYPES[property.propertyType as keyof typeof NZ_PROPERTY_TYPES] || property.propertyType}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Valuation Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Current Valuation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {formatCurrency(currentValue)}
                </div>
                {valuationData && (
                  <div className="text-sm text-gray-500">
                    Last updated: {new Date(Number(valuationData.lastUpdated) * 1000).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Ownership
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-semibold mb-1">{property.ownerName}</div>
                <div className="text-sm text-gray-500 break-all">
                  {property.currentOwner.slice(0, 6)}...{property.currentOwner.slice(-4)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Valuation */}
          {pendingValuation && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Pending Valuation Update
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-blue-700">New Estimated Value</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {formatCurrency(weiToNZD(pendingValuation.estimatedValue))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-blue-700">Comparable Value</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {formatCurrency(weiToNZD(pendingValuation.comparableValue))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 mb-4">
                  <div className="text-center">
                    <div className="text-xs text-blue-600">Location</div>
                    <div className="font-semibold">{pendingValuation.locationScore}/100</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-blue-600">Size</div>
                    <div className="font-semibold">{pendingValuation.sizeScore}/100</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-blue-600">Condition</div>
                    <div className="font-semibold">{pendingValuation.conditionScore}/100</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-blue-600">Age</div>
                    <div className="font-semibold">{pendingValuation.ageScore}/100</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-blue-600">Renovation</div>
                    <div className="font-semibold">{pendingValuation.renovationScore}/100</div>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <Badge 
                      variant={pendingValuation.isVerified ? "default" : "secondary"}
                      className="bg-blue-100 text-blue-800"
                    >
                      {pendingValuation.isVerified ? "✓ Verified" : "Awaiting Verification"}
                    </Badge>
                    <div className="text-sm text-blue-600">
                      Votes: {pendingValuation.verificationVotes} | Rejections: {pendingValuation.rejectionVotes}
                    </div>
                  </div>
                </div>

                {!pendingValuation.isVerified && address?.toLowerCase() !== property.currentOwner.toLowerCase() && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleValuationVote(false)}
                      disabled={transactionPending}
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Reject Valuation
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleValuationVote(true)}
                      disabled={transactionPending}
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Approve Valuation
                    </Button>
                  </div>
                )}

                {pendingValuation.isVerified && address?.toLowerCase() === property.currentOwner.toLowerCase() && (
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Confirm Valuation Update
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Detailed Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="valuation">Valuation</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="technical">Technical</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Property Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Property Type</div>
                        <div className="font-semibold">
                          {NZ_PROPERTY_TYPES[property.propertyType as keyof typeof NZ_PROPERTY_TYPES] || property.propertyType}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Last Renovation</div>
                        <div className="font-semibold">
                          {new Date(Number(property.renovationDate) * 1000).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Estimated Value (ETH)</div>
                      <div className="font-semibold">
                        {ethers.formatEther(property.estimatedValue.toString())} ETH
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Verification Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Approval Votes</div>
                        <div className="font-semibold text-green-600">
                          {Number(property.verificationVotes)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Rejection Votes</div>
                        <div className="font-semibold text-red-600">
                          {Number(property.rejectionVotes)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Status</div>
                      <Badge variant={property.isVerified ? "default" : "secondary"}>
                        {property.isVerified ? "Verified" : "Pending Verification"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="valuation" className="mt-6">
              <div className="space-y-6">
                {/* Valuation Scores */}
                {(valuationData || pendingValuation) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Valuation Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { name: "Location", score: valuationData?.locationScore || pendingValuation?.locationScore || 0 },
                          { name: "Property Size", score: valuationData?.sizeScore || pendingValuation?.sizeScore || 0 },
                          { name: "Condition", score: valuationData?.conditionScore || pendingValuation?.conditionScore || 0 },
                          { name: "Age", score: valuationData?.ageScore || pendingValuation?.ageScore || 0 },
                          { name: "Renovations", score: valuationData?.renovationScore || pendingValuation?.renovationScore || 0 }
                        ].map((factor) => (
                          factor.score > 0 && (
                            <div key={factor.name}>
                              <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">{factor.name}</span>
                                <span className="text-sm text-gray-600">{factor.score}/100</span>
                              </div>
                              <Progress value={factor.score} className="h-2" />
                            </div>
                          )
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Price History Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Price History (Estimated)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historicalData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis 
                            tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), "Value"]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Valuation Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>Valuation Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500">Current Value</div>
                        <div className="text-xl font-bold text-gray-900">
                          {formatCurrency(currentValue)}
                        </div>
                      </div>
                      {pendingValuation && (
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-sm text-blue-600">Pending Value</div>
                          <div className="text-xl font-bold text-blue-800">
                            {formatCurrency(weiToNZD(pendingValuation.estimatedValue))}
                          </div>
                        </div>
                      )}
                      {valuationData && (
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-sm text-green-600">Comparable Value</div>
                          <div className="text-xl font-bold text-green-800">
                            {formatCurrency(weiToNZD(valuationData.comparableValue))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <div className="space-y-6">
                {/* Transaction History */}
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-semibold">Property Created</div>
                          <div className="text-sm text-gray-500">
                            Minted to {property.ownerName}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            Token #{tokenId}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Verification History */}
                <Card>
                  <CardHeader>
                    <CardTitle>Verification Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold">Property Submitted</div>
                          <div className="text-sm text-gray-500">
                            Awaiting community verification
                          </div>
                        </div>
                      </div>
                      
                      {property.isVerified && (
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <div className="font-semibold">Property Verified</div>
                            <div className="text-sm text-gray-500">
                              Verified by community vote
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="technical" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Technical Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Token ID</div>
                      <div className="font-mono text-sm">{tokenId}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Contract Address</div>
                      <div className="font-mono text-sm break-all">{CONTRACT_ADDRESS}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Owner Address</div>
                      <div className="font-mono text-sm break-all">{property.currentOwner}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Token Standard</div>
                      <div className="font-mono text-sm">ERC-721</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Token URI</div>
                    <div className="bg-gray-50 p-3 rounded text-xs font-mono break-all">
                      {property.tokenURI}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`https://sepolia.etherscan.io/token/${CONTRACT_ADDRESS}?a=${tokenId}`, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on Etherscan
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(property.tokenURI)}
                    >
                      Copy Token URI
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="location" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Location Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500">Full Address</div>
                    <div className="font-semibold">{property.propertyAddress}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Latitude</div>
                      <div className="font-mono">{Number(property.latitude) / 1000000}°</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Longitude</div>
                      <div className="font-mono">{Number(property.longitude) / 1000000}°</div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open(`https://maps.google.com/?q=${Number(property.latitude) / 1000000},${Number(property.longitude) / 1000000}`, '_blank')}
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      View on Google Maps
                    </Button>
                  </div>

                  {/* Placeholder for map */}
                  <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <MapPin className="h-8 w-8 mx-auto mb-2" />
                      <div>Interactive map would go here</div>
                      <div className="text-sm">Click "View on Google Maps" above</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}