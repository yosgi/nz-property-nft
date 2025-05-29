"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { ethers } from "ethers"
import contractArtifact from "../../build/contracts/PropertyNFT.json"

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

interface Property {
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
}

export default function MapPage() {
  const [isClient, setIsClient] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsClient(true)
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to view properties")
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || "",
        contractArtifact.abi,
        provider
      )

      // Get total number of properties
      const totalProperties = await contract.getTotalProperties()
      const propertiesArray: Property[] = []

      // Fetch each property's details
      for (let i = 0; i < totalProperties; i++) {
        const property = await contract.getProperty(i)
        propertiesArray.push({
          id: i,
          address: property.propertyAddress,
          ownerName: property.ownerName,
          propertyType: property.propertyType,
          renovationDate: Number(property.renovationDate),
          imageURI: property.imageURI,
          latitude: Number(property.latitude),
          longitude: Number(property.longitude),
          isVerified: property.isVerified,
          estimatedValue: Number(property.estimatedValue)
        })
      }
      console.log(propertiesArray)
      setProperties(propertiesArray)
    } catch (err) {
      console.error("Error fetching properties:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch properties")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Property Map</h1>
        <Button>Add Property</Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle>Interactive 3D Map</CardTitle>
          <CardDescription>Explore properties in an interactive 3D environment powered by CesiumJS</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-6">
          {isClient && <CesiumMap />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading properties..." : `${properties.length} properties found`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Filter properties by type, value, and more</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm">Ponsonby Community</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
                <span className="text-sm">Parnell Community</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm">Validated Properties</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
