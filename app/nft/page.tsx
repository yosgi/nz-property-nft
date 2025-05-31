"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusCircle, ExternalLink, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react"
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
  hasValuation: boolean
  valuationVerified: boolean
  hasPendingValuation: boolean
  pendingValuationVerified: boolean
  hasVotedOnValuation: boolean
  pendingValuationVotes: number
  pendingValuationRejections: number
  pendingEstimatedValue: bigint
  pendingComparableValue: bigint
  pendingLastUpdated: bigint
  pendingLocationScore: number
  pendingSizeScore: number
  pendingConditionScore: number
  pendingAgeScore: number
  pendingRenovationScore: number
}

// Format currency
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

function PropertyCard({ property }: { property: Property }) {
  const { submitVote, submitValuationVote, transactionPending, votingProperty } = useContract()
  const router = useRouter()

  const handleVote = async (approve: boolean) => {
    try {
      await submitVote(property.tokenId.toString(), approve)
    } catch (err) {
      // Error is handled by the provider
    }
  }

  const handleValuationVote = async (approve: boolean) => {
    try {
      await submitValuationVote(property.tokenId.toString(), approve)
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

  // Determine property status
  const getPropertyStatus = () => {
    console.log("property",property)
    if (!property.isVerified) {
      return { 
        label: "Pending Verification", 
        color: "bg-yellow-100 text-yellow-800", 
        icon: <Clock className="h-3 w-3 mr-1" /> 
      }
    }
    
    // Property is verified, check valuation status
    if (property.hasValuation) {
      return { 
        label: "Fully Verified", 
        color: "bg-green-100 text-green-800", 
        icon: <CheckCircle className="h-3 w-3 mr-1" /> 
      }
    }
    
    if (property.hasPendingValuation) {
      if (property.pendingValuationVerified) {
        return { 
          label: "Valuation Verified", 
          color: "bg-purple-100 text-purple-800", 
          icon: <CheckCircle className="h-3 w-3 mr-1" /> 
        }
      } else {
        return { 
          label: "Valuation Submitted", 
          color: "bg-orange-100 text-orange-800", 
          icon: <Clock className="h-3 w-3 mr-1" /> 
        }
      }
    }
    
    // Verified but no valuation at all
    return { 
      label: "Needs Valuation", 
      color: "bg-blue-100 text-blue-800", 
      icon: <TrendingUp className="h-3 w-3 mr-1" /> 
    }
  }

  const status = getPropertyStatus()

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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={status.color}>
            {status.icon}
            {status.label}
          </Badge>
          <Badge variant="outline">{property.propertyType}</Badge>
        </div>
        {!property.isVerified && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Verification: {Number(property.verificationVotes)} votes</span>
            <span>Rejection: {Number(property.rejectionVotes)} votes</span>
          </div>
        )}
        {property.hasPendingValuation && !property.pendingValuationVerified && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Valuation Votes: {property.pendingValuationVotes || 0}</span>
            <span>Rejections: {property.pendingValuationRejections || 0}</span>
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
            <div className="space-y-1">
              {/* Current/Verified Value */}
              <div className="text-2xl font-bold">
                {formatCurrency(Number(property.estimatedValue) / 1e18)}
              </div>
              {/* Pending Value */}
              {property.hasPendingValuation && (
                property.pendingEstimatedValue > 0 || 
                property.pendingLocationScore > 0 || 
                property.pendingSizeScore > 0 ||
                property.pendingConditionScore > 0 ||
                property.pendingAgeScore > 0 ||
                property.pendingRenovationScore > 0
              ) && (
                <div className="text-xs bg-blue-50 border border-blue-200 p-2 rounded space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-800">Pending Valuation:</span>
                    {property.pendingValuationVerified && (
                      <span className="text-green-600 text-xs">✓ Verified</span>
                    )}
                  </div>
                  <div className="text-blue-700">
                    {property.pendingEstimatedValue > 0 && (
                      <p><strong>Est. Value:</strong> {formatCurrency(Number(property.pendingEstimatedValue) / 1e18)}</p>
                    )}
                    {property.pendingComparableValue > 0 && (
                      <p><strong>Comparable:</strong> {formatCurrency(Number(property.pendingComparableValue) / 1e18)}</p>
                    )}
                  </div>
                  {/* Valuation Scores */}
                  {(property.pendingLocationScore > 0 || property.pendingSizeScore > 0 || 
                    property.pendingConditionScore > 0 || property.pendingAgeScore > 0 || 
                    property.pendingRenovationScore > 0) && (
                    <div className="grid grid-cols-2 gap-1 text-xs text-blue-600 mt-2">
                      {property.pendingLocationScore > 0 && (
                        <div>Location: {property.pendingLocationScore}/100</div>
                      )}
                      {property.pendingSizeScore > 0 && (
                        <div>Size: {property.pendingSizeScore}/100</div>
                      )}
                      {property.pendingConditionScore > 0 && (
                        <div>Condition: {property.pendingConditionScore}/100</div>
                      )}
                      {property.pendingAgeScore > 0 && (
                        <div>Age: {property.pendingAgeScore}/100</div>
                      )}
                      {property.pendingRenovationScore > 0 && (
                        <div>Renovation: {property.pendingRenovationScore}/100</div>
                      )}
                    </div>
                  )}
                  {/* Voting Status */}
                  <div className="flex justify-between text-xs text-blue-600 mt-1">
                    <span>Votes: {property.pendingValuationVotes}</span>
                    <span>Rejections: {property.pendingValuationRejections}</span>
                  </div>
                  {/* Last Updated */}
                  {property.pendingLastUpdated > 0 && (
                    <p className="text-xs text-gray-600">
                      Updated: {new Date(Number(property.pendingLastUpdated) * 1000).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
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
          {/* Property verification voting */}
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
          
          {/* Valuation voting */}
          {property.hasPendingValuation && !property.pendingValuationVerified && !property.hasVotedOnValuation && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                onClick={(e) => {
                  e.preventDefault()
                  handleValuationVote(false)
                }}
                disabled={transactionPending && votingProperty === property.tokenId.toString()}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {transactionPending && votingProperty === property.tokenId.toString() ? "Voting..." : "Reject"}
                <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                  {property.pendingValuationRejections || 0}
                </Badge>
              </Button>
              <Button
                variant="outline"
                className="flex-1 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                onClick={(e) => {
                  e.preventDefault()
                  handleValuationVote(true)
                }}
                disabled={transactionPending && votingProperty === property.tokenId.toString()}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                {transactionPending && votingProperty === property.tokenId.toString() ? "Voting..." : "Approve"}
                <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                  {property.pendingValuationVotes || 0}
                </Badge>
              </Button>
            </div>
          )}
          
          {/* Show if user has already voted on valuation */}
          {property.hasPendingValuation && property.hasVotedOnValuation && (
            <div className="text-center py-2">
              <Badge variant="outline" className="bg-gray-50 text-gray-700">
                You have voted on this valuation
              </Badge>
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
  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([])
  const [activeTab, setActiveTab] = useState("pending-verification")
  const [isLoading, setIsLoading] = useState(false)
  const { getPropertiesWithPagination, isReady, transactionPending, connect, propertyValuation, address } = useContract()

  // Fetch all properties
  useEffect(() => {
    const fetchProperties = async () => {
      if (!isReady || !propertyValuation || !address) return
      
      setIsLoading(true)
      try {
        const result = await getPropertiesWithPagination({
          page: 1,
          limit: 100 // Get more properties to filter client-side
        })
        
        // Add valuation status to properties using actual contract data
        const propertiesWithValuation = await Promise.all(
          result.properties.map(async (property) => {
            try {
              if (!propertyValuation) {
                return {
                  ...property,
                  hasValuation: false,
                  valuationVerified: false,
                  hasPendingValuation: false,
                  pendingValuationVerified: false
                }
              }

              // Check for verified valuation (from main valuations mapping)
              let hasValuation = false
              let valuationVerified = false
              try {
                const verifiedValuation = await propertyValuation.getValuation(Number(property.tokenId))
                hasValuation = verifiedValuation && Number(verifiedValuation[0]) > 0 // estimatedValue > 0
                valuationVerified = verifiedValuation && verifiedValuation[8] // isVerified
              } catch (error) {
                // Property might not have verified valuation yet
                hasValuation = false
                valuationVerified = false
              }
              
              // Check for pending valuation
              let hasPendingValuation = false
              let pendingValuationVerified = false
              let pendingValuationVotes = 0
              let pendingValuationRejections = 0
              let hasVotedOnValuation = false
              let pendingEstimatedValue = BigInt(0)
              let pendingComparableValue = BigInt(0)
              let pendingLastUpdated = BigInt(0)
              let pendingLocationScore = 0
              let pendingSizeScore = 0
              let pendingConditionScore = 0
              let pendingAgeScore = 0
              let pendingRenovationScore = 0
              
              try {
                const pendingValuation = await propertyValuation.getPendingValuation(Number(property.tokenId))
                
                // Check if pending valuation exists - look for any non-zero value
                hasPendingValuation = pendingValuation && (
                  Number(pendingValuation.estimatedValue) > 0 ||
                  Number(pendingValuation.comparableValue) > 0 ||
                  pendingValuation.locationScore > 0 ||
                  pendingValuation.sizeScore > 0 ||
                  pendingValuation.conditionScore > 0 ||
                  pendingValuation.ageScore > 0 ||
                  pendingValuation.renovationScore > 0
                )
                
                if (hasPendingValuation && pendingValuation) {
                  pendingValuationVerified = pendingValuation.isVerified
                  pendingValuationVotes = Number(pendingValuation.verificationVotes)
                  pendingValuationRejections = Number(pendingValuation.rejectionVotes)
                  pendingEstimatedValue = pendingValuation.estimatedValue || BigInt(0)
                  pendingComparableValue = pendingValuation.comparableValue || BigInt(0)
                  pendingLastUpdated = pendingValuation.lastUpdated || BigInt(0)
                  pendingLocationScore = Number(pendingValuation.locationScore) || 0
                  pendingSizeScore = Number(pendingValuation.sizeScore) || 0
                  pendingConditionScore = Number(pendingValuation.conditionScore) || 0
                  pendingAgeScore = Number(pendingValuation.ageScore) || 0
                  pendingRenovationScore = Number(pendingValuation.renovationScore) || 0
                }
              } catch (error) {
                // Property might not have pending valuation
                hasPendingValuation = false
                pendingValuationVerified = false
              }
              
              return {
                ...property,
                hasValuation,
                valuationVerified,
                hasPendingValuation,
                pendingValuationVerified,
                hasVotedOnValuation,
                pendingValuationVotes,
                pendingValuationRejections,
                pendingEstimatedValue,
                pendingComparableValue,
                pendingLastUpdated,
                pendingLocationScore,
                pendingSizeScore,
                pendingConditionScore,
                pendingAgeScore,
                pendingRenovationScore
              }
            } catch (error) {
              // Return property with default valuation status
              return {
                ...property,
                hasValuation: false,
                valuationVerified: false,
                hasPendingValuation: false,
                pendingValuationVerified: false,
                hasVotedOnValuation: false,
                pendingValuationVotes: 0,
                pendingValuationRejections: 0,
                pendingEstimatedValue: BigInt(0),
                pendingComparableValue: BigInt(0),
                pendingLastUpdated: BigInt(0),
                pendingLocationScore: 0,
                pendingSizeScore: 0,
                pendingConditionScore: 0,
                pendingAgeScore: 0,
                pendingRenovationScore: 0
              }
            }
          })
        )
        
        setAllProperties(propertiesWithValuation as Property[])
      } catch (error) {
        setError("Failed to fetch properties")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProperties()
  }, [isReady, getPropertiesWithPagination, propertyValuation, address])

  // Filter properties based on active tab
  useEffect(() => {
    let filtered: Property[] = []
    
    switch (activeTab) {
      case "pending-verification":
        // Properties that haven't been verified yet
        filtered = allProperties.filter(p => !p.isVerified)
        break
      case "pending-valuation":
        // Properties that are verified but need valuation OR have pending valuation that needs votes
        filtered = allProperties.filter(p => 
          p.isVerified && (
            // No valuation at all (needs initial valuation)
            (!p.hasValuation && !p.hasPendingValuation) ||
            // Has pending valuation (either waiting for votes or waiting for confirmation)
            (p.hasPendingValuation && !p.pendingValuationVerified)
          )
        )
        break
      case "need-confirm":
        // Properties that have pending verified valuations waiting for confirmation
        filtered = allProperties.filter(p => 
          p.isVerified && 
          p.hasPendingValuation && 
          p.pendingValuationVerified
        )
        break
      case "valuated":
        // Properties that are fully completed - same as verified for now
        filtered = allProperties.filter(p => 
          p.isVerified && p.hasValuation
        )
        break
      default:
        filtered = allProperties.filter(p => !p.isVerified) // Default to pending verification
    }
    
    setFilteredProperties(filtered)
  }, [allProperties, activeTab])

  // Calculate counts for each category
  const pendingVerificationCount = allProperties.filter(p => !p.isVerified).length
  
  const pendingValuationCount = allProperties.filter(p => 
    p.isVerified && (
      (!p.hasValuation && !p.hasPendingValuation) ||
      (p.hasPendingValuation && !p.pendingValuationVerified)
    )
  ).length

  const needConfirmCount = allProperties.filter(p => 
    p.isVerified && 
    p.hasPendingValuation && 
    p.pendingValuationVerified
  ).length
  
  const valuatedCount = allProperties.filter(p => 
    p.isVerified && p.hasValuation
  ).length

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

      <Tabs defaultValue="pending-verification" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending-verification" className="relative">
            Need Verification
            {pendingVerificationCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                {pendingVerificationCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending-valuation" className="relative">
            Need Valuation
            {pendingValuationCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-200">
                {pendingValuationCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="need-confirm" className="relative">
            Need Confirm
            {needConfirmCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800 hover:bg-orange-200">
                {needConfirmCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="valuated" className="relative">
            Valuated
            {valuatedCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-800 hover:bg-purple-200">
                {valuatedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="relative mt-6">
          {/* Loading Overlay */}
          {(isLoading || transactionPending) && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                <p className="text-sm text-gray-600">
                  {isLoading ? "Loading properties..." : "Processing transaction..."}
                </p>
              </div>
            </div>
          )}

          {/* All tab content renders the same grid, just with different filtered data */}
          {["pending-verification", "pending-valuation", "need-confirm", "valuated"].map((tabValue) => (
            <TabsContent key={tabValue} value={tabValue} className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.map((property) => (
                  <PropertyCard key={property.tokenId.toString()} property={property} />
                ))}
              </div>
              {filteredProperties.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <h2 className="text-xl font-semibold text-gray-600">
                    No properties found in this category
                  </h2>
                  <p className="text-gray-500 mt-2">
                    {tabValue === "pending-verification" && "All properties have been verified!"}
                    {tabValue === "pending-valuation" && "No properties need valuation!"}
                    {tabValue === "need-confirm" && "No properties need confirmation!"}
                    {tabValue === "valuated" && "No fully valuated properties yet!"}
                  </p>
                  {tabValue === "pending-verification" && (
                    <Link href="/submit" className="mt-4 inline-block">
                      <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Submit Property
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}