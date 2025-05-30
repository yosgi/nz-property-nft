"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusCircle, ExternalLink, CheckCircle, XCircle } from "lucide-react"
import contractArtifact from "../../public/contracts/PropertyNFT.json"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""

interface Property {
  id: number
  address: string
  ownerName: string
  propertyType: string
  renovationDate: bigint
  imageURI: string
  latitude: bigint
  longitude: bigint
  estimatedValue: bigint
  isVerified: boolean
  tokenURI: string
  owner: string
  verificationVotes: number
  rejectionVotes: number
}

export default function NFTListPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isContractDeployed, setIsContractDeployed] = useState(false)

  useEffect(() => {
    const checkContractDeployment = async () => {
      try {
        if (!window.ethereum) {
          throw new Error("Please install MetaMask to view properties")
        }

        const provider = new ethers.BrowserProvider(window.ethereum)
        
        // Check if contract is deployed
        const code = await provider.getCode(CONTRACT_ADDRESS)
        if (code === "0x") {
          throw new Error("Contract is not deployed at the specified address")
        }

        setIsContractDeployed(true)
        return true
      } catch (err) {
        console.error("Error checking contract deployment:", err)
        setError(err instanceof Error ? err.message : "Failed to check contract deployment")
        return false
      }
    }

    const fetchProperties = async () => {
      try {
        if (!window.ethereum) {
          throw new Error("Please install MetaMask to view properties")
        }

        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, provider)

        console.log("Contract address:", CONTRACT_ADDRESS)
        console.log("Contract ABI:", contractArtifact.abi)

        // Start with index 0 and keep fetching until we get an error
        const propertiesData: Property[] = []
        let index = 0
        let hasMore = true

        while (hasMore) {
          try {
            console.log(`Fetching property ${index}...`)
            // Get property data from the properties mapping
            const propertyData = await contract.properties(index)
            console.log(`Property ${index} data:`, propertyData)
            
            // Check if the property exists by checking if the address is not empty
            if (!propertyData[0] || propertyData[0] === "") {
              console.log(`Property ${index} does not exist, stopping...`)
              hasMore = false
              continue
            }
            
            // Get owner address
            const owner = await contract.ownerOf(index)
            console.log(`Property ${index} owner:`, owner)
            
            // Get token URI
            const tokenURI = await contract.tokenURI(index)
            console.log(`Property ${index} tokenURI:`, tokenURI)

            // Convert BigNumber values to numbers
            const verificationVotes = Number(propertyData[9]?.toString() || "0")
            const rejectionVotes = Number(propertyData[10]?.toString() || "0")

            propertiesData.push({
              id: index,
              address: propertyData[0],
              ownerName: propertyData[1],
              propertyType: propertyData[2],
              renovationDate: propertyData[3],
              imageURI: propertyData[4],
              latitude: propertyData[5],
              longitude: propertyData[6],
              isVerified: propertyData[7],
              estimatedValue: propertyData[8],
              tokenURI,
              owner,
              verificationVotes,
              rejectionVotes
            })

            console.log(`Successfully added property ${index} to list`)
            index++
          } catch (err) {
            console.error(`Error fetching property ${index}:`, err)
            // If we get an error, we've reached the end of the properties
            hasMore = false
          }
        }

        console.log("Final properties list:", propertiesData)
        setProperties(propertiesData)
      } catch (err) {
        console.error("Error fetching properties:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch properties")
      } finally {
        setLoading(false)
      }
    }

    const initialize = async () => {
      const isDeployed = await checkContractDeployment()
      if (isDeployed) {
        await fetchProperties()
      } else {
        setLoading(false)
      }
    }

    initialize()
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
        {!isContractDeployed && (
          <div className="mt-4 text-center">
            <p className="text-gray-600 mb-4">The contract is not deployed. Please deploy the contract first.</p>
            <Link href="/deploy">
              <Button>
                Deploy Contract
              </Button>
            </Link>
          </div>
        )}
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
              <div className="relative w-full h-48 overflow-hidden">
                <img
                  src={property.imageURI.replace('ipfs://', 'https://ipfs.io/ipfs/')}
                  alt={`Property ${property.id}`}
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
                    <span>Verification: {property.verificationVotes} votes</span>
                    <span>Rejection: {property.rejectionVotes} votes</span>
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
