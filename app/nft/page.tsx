"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusCircle, ExternalLink, CheckCircle, XCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import contractArtifact from "../../public/contracts/PropertyNFT.json"
import { useContract } from "../contexts/ContractProvider"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""

type Property = {
  tokenId: bigint
  propertyAddress: string
  ownerName: string
  propertyType: string
  renovationDate: bigint
  imageURI: string
  latitude: bigint
  longitude: bigint
  estimatedValue: bigint
  isVerified: boolean
  currentOwner: string
  verificationVotes: bigint
  rejectionVotes: bigint
}

function PropertyCard({ property }: { property: Property }) {
  const { submitVote, transactionPending, votingProperty } = useContract()
  const router = useRouter()

  const handleVote = async (approve: boolean) => {
    try {
      await submitVote(property.tokenId.toString(), approve)
    } catch (err) {
      // Error is handled by the provider
    }
  }

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      const tokenIdStr = property.tokenId.toString()
      router.push(`/nft/${tokenIdStr}`)
    } catch (error) {
      console.error("Error navigating to property details:", error)
      toast.error("Failed to view property details")
    }
  }

  return (
    <Card className="h-full hover:shadow-lg transition-shadow duration-200">
      <div className="relative w-full h-48 overflow-hidden">
        <img
          src={property.imageURI.replace('ipfs://', 'https://ipfs.io/ipfs/')}
          alt={`Property ${property.tokenId.toString()}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-property.jpg';
          }}
        />
      </div>
      <CardHeader className="space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="line-clamp-1">Property #{property.tokenId.toString()}</CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              {property.propertyAddress}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault()
              window.open(`https://etherscan.io/address/${property.currentOwner}`, '_blank')
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={property.isVerified ? "default" : "secondary"}>
            {property.isVerified ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {property.isVerified ? "Verified" : "Unverified"}
          </Badge>
          <Badge variant="outline">{property.propertyType}</Badge>
        </div>
        {!property.isVerified && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Verification: {Number(property.verificationVotes)} votes</span>
            <span>Rejection: {Number(property.rejectionVotes)} votes</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Owner</h3>
            <p className="text-sm line-clamp-1">{property.ownerName}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Estimated Value</h3>
            <p className="text-sm font-semibold">
              {ethers.formatEther(property.estimatedValue.toString())} ETH
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Location</h3>
            <p className="text-sm">
              {Number(property.latitude) / 1000000}, {Number(property.longitude) / 1000000}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="w-full space-y-2">
          {!property.isVerified && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                onClick={(e) => {
                  e.preventDefault()
                  handleVote(false)
                }}
                disabled={transactionPending && votingProperty === property.tokenId.toString()}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {transactionPending && votingProperty === property.tokenId.toString() ? "Voting..." : "Reject"}
                <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                  {Number(property.rejectionVotes)}
                </Badge>
              </Button>
              <Button
                className="flex-1 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                onClick={(e) => {
                  e.preventDefault()
                  handleVote(true)
                }}
                disabled={transactionPending && votingProperty === property.tokenId.toString()}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {transactionPending && votingProperty === property.tokenId.toString() ? "Voting..." : "Approve"}
                <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                  {Number(property.verificationVotes)}
                </Badge>
              </Button>
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={handleViewDetails}>
            View Details
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

export default function NFTListPage() {
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const { getPropertiesWithPagination, isReady, transactionPending, connect } = useContract()

  // Fetch properties when tab changes or when ready state changes
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const result = await getPropertiesWithPagination({
          verifiedOnly: activeTab === "verified",
          propertyType: activeTab === "my-properties" ? undefined : undefined,
          owner: activeTab === "my-properties" ? (window.ethereum as any)?.selectedAddress : undefined
        })
        setProperties(result.properties as Property[])
      } catch (error) {
        console.error("Error fetching properties:", error)
        setError("Failed to fetch properties")
      }
    }

    if (isReady) {
      fetchProperties()
    }
  }, [activeTab, isReady, getPropertiesWithPagination])

  // Calculate counts for each category
  const verifiedCount = properties.filter(p => p.isVerified).length
  const unverifiedCount = properties.filter(p => !p.isVerified).length
  const myPropertiesCount = properties.filter(p => p.currentOwner.toLowerCase() === (window.ethereum as any)?.selectedAddress?.toLowerCase()).length

  if (!isReady) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h1 className="text-3xl font-bold mb-4">Property NFTs</h1>
          <p className="text-gray-600 mb-8">Please connect your wallet to view properties</p>
          <Button onClick={connect} size="lg">
            Connect Wallet
          </Button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Property NFTs</h1>
        <Link href="/submit">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Submit Property
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="relative">
            All Properties
            {properties.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-800 hover:bg-gray-200">
                {properties.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="verified" className="relative">
            Verified
            {verifiedCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 hover:bg-green-200">
                {verifiedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unverified" className="relative">
            Unverified
            {unverifiedCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                {unverifiedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-properties" className="relative">
            My Properties
            {myPropertiesCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-200">
                {myPropertiesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="relative mt-6">
          {/* Loading Overlay */}
          {transactionPending && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                <p className="text-sm text-gray-600">
                  Processing transaction...
                </p>
              </div>
            </div>
          )}

          <TabsContent value="all" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <PropertyCard key={property.tokenId.toString()} property={property} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="verified" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <PropertyCard key={property.tokenId.toString()} property={property} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="unverified" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <PropertyCard key={property.tokenId.toString()} property={property} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="my-properties" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <PropertyCard key={property.tokenId.toString()} property={property} />
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {properties.length === 0 && (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-600">No properties found</h2>
          <p className="text-gray-500 mt-2">Be the first to submit a property!</p>
          <Link href="/submit" className="mt-4 inline-block">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Submit Property
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
