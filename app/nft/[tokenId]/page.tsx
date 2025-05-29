"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ethers } from "ethers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Share2, ArrowRight, ExternalLink } from "lucide-react"
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

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""
const VALUATION_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_VALUATION_ADDRESS || ""
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"

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
  address: string
  ownerName: string
  propertyType: string
  renovationDate: number
  tokenURI: string
  isVerified: boolean
  estimatedValue: bigint
  owner: string
  latitude: number
  longitude: number
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
  const [property, setProperty] = useState<PropertyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [transferAddress, setTransferAddress] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferDetails, setTransferDetails] = useState<TransferDetails | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        if (!window.ethereum) {
          throw new Error("Please install MetaMask to view NFT details")
        }

        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, provider)

        // Get property data
        const propertyData = await contract.getProperty(tokenId)
        console.log("Property Data from Contract:", propertyData) // Debug log

        // Get owner
        const owner = await contract.ownerOf(tokenId)

        // Get token URI
        const tokenURI = await contract.tokenURI(tokenId)
        console.log("Token URI:", tokenURI) // Debug log

        // Convert IPFS URL to HTTP URL
        if (tokenURI && tokenURI.startsWith('ipfs://')) {
          const ipfsHash = tokenURI.replace('ipfs://', '')
          setImageUrl(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`)
        }

        setProperty({
          address: propertyData.propertyAddress || "",
          ownerName: propertyData.ownerName || "",
          propertyType: propertyData.propertyType || "",
          renovationDate: Number(propertyData.renovationDate || 0),
          tokenURI: tokenURI || "",
          isVerified: propertyData.isVerified || false,
          estimatedValue: propertyData.estimatedValue || BigInt(0),
          owner,
          latitude: Number(propertyData.latitude || 0),
          longitude: Number(propertyData.longitude || 0),
        })
      } catch (err) {
        console.error("Error fetching property data:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch property data")
      } finally {
        setLoading(false)
      }
    }

    fetchPropertyData()
  }, [tokenId])

  const resolveENS = async (name: string): Promise<string | null> => {
    try {
      if (!window.ethereum) throw new Error("No ethereum provider found")
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const ensRegistry = new ethers.Contract(
        ENS_REGISTRY,
        [
          "function resolver(bytes32 node) external view returns (address)",
          "function name(bytes32 node) external view returns (string)",
        ],
        provider
      )
      const resolver = await ensRegistry.resolver(ethers.namehash(name))
      if (resolver === ethers.ZeroAddress) return null
      return resolver
    } catch (err) {
      console.error("Error resolving ENS:", err)
      return null
    }
  }

  const estimateGas = async (to: string): Promise<string> => {
    try {
      if (!window.ethereum) throw new Error("No ethereum provider found")
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signer)
      const userAddress = await signer.getAddress()
      
      const gasEstimate = await contract.transferFrom.estimateGas(userAddress, to, tokenId)
      const gasPrice = await provider.getFeeData()
      const gasCost = gasEstimate * (gasPrice.gasPrice || BigInt(0))
      
      return ethers.formatEther(gasCost)
    } catch (err) {
      console.error("Error estimating gas:", err)
      throw new Error("Failed to estimate gas cost")
    }
  }

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
        if (!window.ethereum) throw new Error("No ethereum provider found")
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

      const gasEstimate = await estimateGas(resolvedAddress)
      setTransferDetails({
        recipient: resolvedAddress,
        gasEstimate,
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
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to transfer NFT")
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signer)

      // Check if the user is the owner
      const owner = await contract.ownerOf(tokenId)
      const userAddress = await signer.getAddress()
      
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error("You are not the owner of this NFT")
      }

      // Transfer the NFT
      const tx = await contract.transferFrom(userAddress, transferDetails.recipient, tokenId)
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
      const propertyData = await contract.getProperty(tokenId)
      const newOwner = await contract.ownerOf(tokenId)
      const tokenURI = await contract.tokenURI(tokenId)

      setProperty({
        address: propertyData.propertyAddress || "",
        ownerName: propertyData.ownerName || "",
        propertyType: propertyData.propertyType || "",
        renovationDate: Number(propertyData.renovationDate || 0),
        tokenURI: tokenURI || "",
        isVerified: propertyData.isVerified || false,
        estimatedValue: propertyData.estimatedValue || BigInt(0),
        owner: newOwner,
        latitude: Number(propertyData.latitude || 0),
        longitude: Number(propertyData.longitude || 0),
      })
    } catch (err) {
      console.error("Error transferring NFT:", err)
      toast.error(err instanceof Error ? err.message : "Failed to transfer NFT")
    } finally {
      setIsTransferring(false)
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
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
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
    <div className="max-w-4xl mx-auto p-4">
      <div className="space-y-6">
        {/* Property Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Property NFT #{tokenId}</h1>
          <p className="text-gray-600">{property.address}</p>
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
        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Property at ${property.address}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500">No image available</span>
            </div>
          )}
        </div>

        {/* Property Details */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
            <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
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
                    {new Date(property.renovationDate * 1000).toLocaleDateString()}
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
                    Latitude: {property.latitude / 1000000}°<br />
                    Longitude: {property.longitude / 1000000}°
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
                  <p className="text-gray-600 break-all">{property.owner}</p>
                </div>
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