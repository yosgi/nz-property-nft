"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusCircle, ExternalLink } from "lucide-react"
import contractArtifact from "../../public/contracts/PropertyNFT.json"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""

interface Property {
  id: number
  address: string
  ownerName: string
  propertyType: string
  estimatedValue: bigint
  isVerified: boolean
  tokenURI: string
  owner: string
}

export default function NFTListPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        if (!window.ethereum) {
          throw new Error("Please install MetaMask to view properties")
        }

        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, provider)

        const totalProperties = await contract.getTotalProperties()
        const propertiesData: Property[] = []

        for (let i = 0; i < totalProperties; i++) {
          const propertyData = await contract.getProperty(i)
          const owner = await contract.ownerOf(i)
          const tokenURI = await contract.tokenURI(i)

          propertiesData.push({
            id: i,
            address: propertyData.propertyAddress,
            ownerName: propertyData.ownerName,
            propertyType: propertyData.propertyType,
            estimatedValue: propertyData.estimatedValue,
            isVerified: propertyData.isVerified,
            tokenURI,
            owner,
          })
        }

        setProperties(propertiesData)
      } catch (err) {
        console.error("Error fetching properties:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch properties")
      } finally {
        setLoading(false)
      }
    }

    fetchProperties()
  }, [])

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((property) => (
          <Link href={`/nft/${property.id}`} key={property.id}>
            <Card className="h-full hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="line-clamp-1">Property #{property.id}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {property.address}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault()
                      window.open(`https://etherscan.io/address/${property.owner}`, '_blank')
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={property.isVerified ? "default" : "secondary"}>
                    {property.isVerified ? "Verified" : "Unverified"}
                  </Badge>
                  <Badge variant="outline">{property.propertyType}</Badge>
                </div>
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
                </div>
              </CardContent>
              <CardFooter>
                <div className="w-full">
                  <Button variant="outline" className="w-full">
                    View Details
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>

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
