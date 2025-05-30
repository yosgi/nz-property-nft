"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ethers } from "ethers"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Share2, ArrowRight, ExternalLink, PlusCircle, ArrowLeft, CheckCircle, XCircle } from "lucide-react"
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
import contractArtifact from "../../../public/contracts/PropertyNFT.json"
import valuationContractArtifact from "../../../public/contracts/PropertyValuation.json"
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

// Interface for property valuation history
interface ValuationRecord {
  value: bigint
  timestamp: number
  locationScore: number
  areaScore: number
  conditionScore: number
  ageScore: number
  renovationScore: number
  updateReason?: string
  renovationDetails?: string
  renovationDate?: number
}

// Interface for verification history
interface VerificationRecord {
  timestamp: number
  status: boolean
  verifier: string
  notes?: string
}

// Interface for transaction history
interface TransactionRecord {
  timestamp: number
  from: string
  to: string
  transactionHash: string
}

interface PropertyData {
  propertyAddress: string
  ownerName: string
  propertyType: string
  renovationDate: bigint
  tokenURI: string
  isVerified: boolean
  estimatedValue: bigint
  currentOwner: string
  latitude: bigint
  longitude: bigint
  verificationVotes: bigint
  rejectionVotes: bigint
  valuationHistory: any[]
  verificationHistory: any[]
  transactionHistory: any[]
  bedrooms?: number
  bathrooms?: number
  landArea?: number
  buildingArea?: number
  yearBuilt?: number
  lastSalePrice?: bigint
  lastSaleDate?: number
}

interface TransferDetails {
  recipient: string
  gasEstimate: string
  isENS: boolean
  ensName?: string
}

export default function NFTDetailPage() {
  const params = useParams()
  const tokenId = params.tokenId as string
  console.log("tokenId",tokenId)
  const { getProperty, transferNFT, submitVote, transactionPending, votingProperty, connect, estimateTransferGas } = useContract()
  const [property, setProperty] = useState<PropertyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [transferAddress, setTransferAddress] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferDetails, setTransferDetails] = useState<TransferDetails | null>(null)

  const refreshProperty = async () => {
    setError(null)
    try {
      // Ensure tokenId is valid
      if (tokenId === undefined || tokenId === null) {
        throw new Error("Invalid token ID")
      }
      const propertyData = await getProperty(tokenId)
      setProperty(propertyData)
      console.log("Property data:", propertyData)
      setImageUrl(propertyData.imageURI)
      
    } catch (err) {
      console.error("Error fetching property data:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch property data")
    } 
  }

  useEffect(() => {
    refreshProperty()
  }, [tokenId])

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

      // Close modal and reset form
      setIsTransferModalOpen(false)
      setTransferAddress("")
      setTransferDetails(null)
      
      // Refresh property data
      await refreshProperty()
    } catch (err) {
      console.error("Error transferring NFT:", err)
      toast.error(err instanceof Error ? err.message : "Failed to transfer NFT")
    } finally {
      setIsTransferring(false)
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
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
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Property not found
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Link href="/nft">
        <Button variant="outline" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </Link>

      <div className="space-y-6 max-w-[600px] mx-auto relative">
        {/* Loading Overlay */}
        {(transactionPending) && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              <p className="text-sm text-gray-600">
                {transactionPending ? "Processing transaction..." : "Loading property data..."}
              </p>
            </div>
          </div>
        )}

        {/* Property Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Property NFT #{tokenId}</h1>
          <p className="text-gray-600">{property.propertyAddress}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={property.isVerified ? "default" : "secondary"}>
              {property.isVerified ? "Verified" : "Unverified"}
            </Badge>
            <Badge variant="outline">
              {NZ_PROPERTY_TYPES[property.propertyType as keyof typeof NZ_PROPERTY_TYPES] || property.propertyType}
            </Badge>
          </div>
        </div>

        {/* Property Image */}
        <div className="relative aspect-[16/9] max-h-[300px] rounded-lg overflow-hidden bg-gray-100 w-full">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Property at ${property.propertyAddress}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500">No image available</span>
            </div>
          )}
        </div>

        {/* Voting Buttons */}
        {!property.isVerified && (
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
              onClick={() => submitVote(tokenId, false)}
              disabled={transactionPending && votingProperty === tokenId}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {transactionPending && votingProperty === tokenId ? "Voting..." : "Reject"}
              <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                {Number(property.rejectionVotes)  }
              </Badge>
            </Button>
            <Button
              className="flex-1 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
              onClick={() => submitVote(tokenId, true)}
              disabled={transactionPending && votingProperty === tokenId}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {transactionPending && votingProperty === tokenId ? "Voting..." : "Approve"}
              <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                {Number(property.verificationVotes)}
              </Badge>
            </Button>
          </div>
        )}

        {/* Property Details */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
            <TabsTrigger value="valuation">Valuation</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">Property Type</h3>
                  <p className="text-gray-600">
                    {NZ_PROPERTY_TYPES[property.propertyType as keyof typeof NZ_PROPERTY_TYPES] || property.propertyType}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Last Renovation</h3>
                  <p className="text-gray-600">
                    {new Date(Number(property.renovationDate) * 1000).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Estimated Value</h3>
                  <p className="text-gray-600">
                    {ethers.formatEther(property.estimatedValue.toString())} ETH
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Coordinates</h3>
                  <p className="text-gray-600">
                    Latitude: {Number(property.latitude) / 1000000}°<br />
                    Longitude: {Number(property.longitude) / 1000000}°
                  </p>
                </div>
            
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ownership">
            <Card>
              <CardHeader>
                <CardTitle>Ownership Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">Owner Name</h3>
                  <p className="text-gray-600">{property.ownerName}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Owner Address</h3>
                  <p className="text-gray-600 break-all">{property.currentOwner}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="valuation">
            <Card>
              <CardHeader>
                <CardTitle>Valuation History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {property?.valuationHistory?.map((record, index) => (
                  <div key={index} className="border-b pb-4 last:border-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">
                          {ethers.formatEther(record.value.toString())} ETH
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(record.timestamp * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span>Location Score:</span>
                          <span>{record.locationScore}</span>
                          <span>Area Score:</span>
                          <span>{record.areaScore}</span>
                          <span>Condition Score:</span>
                          <span>{record.conditionScore}</span>
                          <span>Age Score:</span>
                          <span>{record.ageScore}</span>
                          <span>Renovation Score:</span>
                          <span>{record.renovationScore}</span>
                        </div>
                      </div>
                    </div>
                    {record.updateReason && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Update Reason:</span> {record.updateReason}
                      </p>
                    )}
                    {record.renovationDetails && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Renovation Details:</span> {record.renovationDetails}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification">
            <Card>
              <CardHeader>
                <CardTitle>Verification History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {property?.verificationHistory?.map((record, index) => (
                  <div key={index} className="border-b pb-4 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant={record.status ? "default" : "secondary"}>
                          {record.status ? "Verified" : "Unverified"}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(record.timestamp * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 break-all">
                          Verifier: {record.verifier}
                        </p>
                        {record.notes && (
                          <p className="text-sm text-gray-600 mt-1">{record.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {property?.transactionHistory?.map((record, index) => (
                  <div key={index} className="border-b pb-4 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-600">
                          From: {record.from}
                        </p>
                        <p className="text-sm text-gray-600">
                          To: {record.to}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(record.timestamp * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`https://etherscan.io/tx/${record.transactionHash}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blockchain">
            <Card>
              <CardHeader>
                <CardTitle>Blockchain Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">Token ID</h3>
                  <p className="text-gray-600">{tokenId}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Contract Address</h3>
                  <p className="text-gray-600 break-all">{CONTRACT_ADDRESS}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Token URI</h3>
                  <p className="text-gray-600 break-all">{property.tokenURI}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => window.open(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`, '_blank')}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share Contract
          </Button>
          <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1">
                Transfer
                <ArrowRight className="ml-2 h-4 w-4" />
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
                          <p className="text-gray-600 break-all">
                            {transferDetails.isENS ? (
                              <>
                                {transferDetails.ensName}
                                <span className="text-sm text-gray-400 ml-2">
                                  ({transferDetails.recipient})
                                </span>
                              </>
                            ) : (
                              transferDetails.recipient
                            )}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`https://etherscan.io/address/${transferDetails.recipient}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
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
                  {isTransferring ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Transferring...
                    </>
                  ) : (
                    "Transfer"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
} 