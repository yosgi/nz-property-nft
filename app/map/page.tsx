"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, PlusCircle, Filter, MapPin } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useContract } from "../contexts/ContractProvider"
import { PropertyData } from "../types/property"

// Dynamically import the CesiumMap component with no SSR
const CesiumMap = dynamic(() => import("@/components/cesium-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2">Loading 3D Map...</span>
    </div>
  ),
})

interface MapProperty {
  id: number;
  address: string;
  ownerName: string;
  propertyType: string;
  renovationDate: number;
  imageURI: string;
  latitude: number;
  longitude: number;
  isVerified: boolean;
  estimatedValue: number;
  currentOwner: string;
  verificationVotes: number;
  rejectionVotes: number;
}

export default function MapPage() {
  const [isClient, setIsClient] = useState(false)
  const [properties, setProperties] = useState<MapProperty[]>([])
  const [filteredProperties, setFilteredProperties] = useState<MapProperty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>("")
  const [verificationFilter, setVerificationFilter] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Use the contract context
  const { 
    getPropertiesWithPagination, 
    isReady, 
    connect, 
    address,
    transactionPending 
  } = useContract()

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch properties using the contract provider
  const fetchProperties = async (applyFilters = false) => {
    try {
      setIsLoading(true)
      setError(null)

      // Check if contract is ready
      if (!isReady) {
        setError("Contract not ready. Please wait or try connecting your wallet.")
        return
      }

      // Fetch all properties without filters first to get complete dataset
      const result = await getPropertiesWithPagination({ 
        page: 1, 
        limit: 1000, // Large limit to get all properties for map display
        verifiedOnly: false, // Always fetch all initially
        propertyType: undefined // No filter initially
      })

      // Convert PropertyData to MapProperty format with better error handling
      const mapProperties: MapProperty[] = result.properties
        .filter(property => property && property.tokenId !== undefined)
        .map((property: PropertyData) => {
          try {
            return {
              id: Number(property.tokenId),
              address: property.propertyAddress || "Unknown Address",
              ownerName: property.ownerName || "Unknown Owner",
              propertyType: property.propertyType || "Unknown Type",
              renovationDate: Number(property.renovationDate) || 0,
              imageURI: property.imageURI || "",
              // Handle coordinate conversion more safely
              latitude: property.latitude ? Number(property.latitude) / 1000000 : 0,
              longitude: property.longitude ? Number(property.longitude) / 1000000 : 0,
              isVerified: Boolean(property.isVerified),
              estimatedValue: Number(property.estimatedValue) || 0,
              currentOwner: property.currentOwner || "",
              verificationVotes: Number(property.verificationVotes) || 0,
              rejectionVotes: Number(property.rejectionVotes) || 0
            }
          } catch (conversionError) {
            console.warn("Error converting property:", property, conversionError)
            return null
          }
        })
        .filter((property): property is MapProperty => property !== null)

      setProperties(mapProperties)
      // Apply existing filters to new data
      applyFiltersToProperties(mapProperties)
      setTotalPages(result.totalPages)
      
    } catch (err) {
      console.error("Error fetching properties:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch properties"
      
      // Provide more specific error messages
      if (errorMessage.includes("user rejected")) {
        setError("Transaction was rejected. Please try again.")
      } else if (errorMessage.includes("network")) {
        setError("Network error. Please check your connection and try again.")
      } else if (errorMessage.includes("Contract not ready")) {
        setError("Please connect your wallet to view properties.")
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Separate function to apply filters
  const applyFiltersToProperties = (allProperties: MapProperty[]) => {
    let filtered = [...allProperties]

    if (propertyTypeFilter) {
      filtered = filtered.filter(p => p.propertyType === propertyTypeFilter)
    }

    if (verificationFilter === "verified") {
      filtered = filtered.filter(p => p.isVerified)
    } else if (verificationFilter === "unverified") {
      filtered = filtered.filter(p => !p.isVerified)
    }

    setFilteredProperties(filtered)
  }

  // Initial fetch when contract is ready
  useEffect(() => {
    if (isReady) {
      fetchProperties()
    }
  }, [isReady])

  // Apply filters when filter values change
  useEffect(() => {
    if (properties.length > 0) {
      applyFiltersToProperties(properties)
    }
  }, [propertyTypeFilter, verificationFilter, properties])

  // Auto-refresh properties every 30 seconds if connected
  useEffect(() => {
    if (!isReady) return

    const interval = setInterval(() => {
      fetchProperties()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [isReady])

  // Get unique property types for filter (with loading protection)
  const propertyTypes = properties.length > 0 
    ? [...new Set(properties.map(p => p.propertyType))].filter(Boolean)
    : []

  // Calculate statistics (with safety checks)
  const verifiedCount = properties.filter(p => p.isVerified).length
  const totalValue = properties.reduce((sum, p) => sum + (p.estimatedValue || 0), 0)
  const averageValue = properties.length > 0 ? totalValue / properties.length : 0

  // Handle filter clearing
  const clearFilters = () => {
    setPropertyTypeFilter("")
    setVerificationFilter("")
  }

  // Check if any filters are active
  const hasActiveFilters = propertyTypeFilter || verificationFilter

  // Handle manual refresh
  const handleRefresh = () => {
    fetchProperties()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Property Map</h1>
          <p className="text-muted-foreground">
            Interactive 3D visualization of {properties.length} properties
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/properties/submit">
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Property
            </Button>
          </Link>
          {!address && (
            <Button onClick={connect} variant="outline">
              Connect Wallet
            </Button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      {!isReady && !isLoading && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Connecting to blockchain...</span>
              </div>
              {!address && (
                <Button onClick={connect} size="sm">
                  Connect Wallet
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-red-700">{error}</p>
              <div className="flex gap-2">
                {!address && error.includes("connect") && (
                  <Button onClick={connect} variant="outline" size="sm">
                    Connect Wallet
                  </Button>
                )}
                <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retry"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <Select value={propertyTypeFilter || "all"} onValueChange={(value) => setPropertyTypeFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Property Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {propertyTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={verificationFilter || "all"} onValueChange={(value) => setVerificationFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Verification Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified Only</SelectItem>
                <SelectItem value="unverified">Unverified Only</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button 
                variant="outline" 
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="ml-auto"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3D Map */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Interactive 3D Map
          </CardTitle>
          <CardDescription>
            Explore {filteredProperties.length} properties in an interactive 3D environment powered by CesiumJS
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-6">
        <CesiumMap properties={filteredProperties} />
          {/* {isClient && (
            isLoading ? (
              <div className="w-full h-[600px] flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading property data...</span>
              </div>
            ) : (
              <CesiumMap properties={filteredProperties} />
            )
          )} */}
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? "..." : properties.length}
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredProperties.length !== properties.length && 
                `${filteredProperties.length} shown after filters`
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Verified Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? "..." : verifiedCount}
            </div>
            <p className="text-sm text-muted-foreground">
              {properties.length > 0 && 
                `${Math.round((verifiedCount / properties.length) * 100)}% verified`
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {isLoading ? "..." : `${(totalValue / 1000000).toFixed(1)}M`}
            </div>
            <p className="text-sm text-muted-foreground">
              Avg: ${averageValue > 0 ? (averageValue / 1000).toFixed(0) : "0"}K per property
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Property Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {isLoading ? "..." : propertyTypes.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Different property types
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Map Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
              <span className="text-sm">Verified Properties</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-yellow-500 mr-2"></div>
              <span className="text-sm">Pending Verification</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
              <span className="text-sm">High Value Properties</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
              <span className="text-sm">Recently Added</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}