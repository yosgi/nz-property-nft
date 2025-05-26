"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExternalLink, Share2 } from "lucide-react"

// Mock property data
const mockProperty = {
  tokenId: "0x1a2b3c4d5e6f",
  address: "123 Blockchain Ave, Crypto City, CC 12345",
  ownerName: "Alex Blockchain",
  renovationDate: "2023-05-15",
  propertyType: "Single Family Home",
  image: "/placeholder.svg?height=400&width=600",
  blockchain: "Ethereum",
  contractAddress: "0x1234567890abcdef1234567890abcdef12345678",
  lastVerified: "2023-10-01",
  estimatedValue: "$1,250,000",
  comparableValue: "$1,200,000",
}

export default function NFTPage() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mockProperty.tokenId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Property NFT</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="overflow-hidden">
            <img
              src={mockProperty.image || "/placeholder.svg"}
              alt={mockProperty.address}
              className="w-full h-auto object-cover aspect-square"
            />
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <Badge variant="outline">{mockProperty.propertyType}</Badge>
                <Button variant="ghost" size="icon" onClick={copyToClipboard}>
                  <Share2 className="h-4 w-4" />
                  <span className="sr-only">Share</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">Property NFT #{mockProperty.tokenId.substring(0, 8)}</CardTitle>
                  <CardDescription className="mt-1">{mockProperty.address}</CardDescription>
                </div>
                <Badge className="ml-2">{mockProperty.blockchain}</Badge>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="ownership">Ownership</TabsTrigger>
                  <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Property Type</p>
                      <p>{mockProperty.propertyType}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Renovation</p>
                      <p>{mockProperty.renovationDate}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Verified</p>
                      <p>{mockProperty.lastVerified}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Estimated Value</p>
                      <p className="font-semibold">{mockProperty.estimatedValue}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ownership" className="space-y-4 mt-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Owner</p>
                    <p>{mockProperty.ownerName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ownership History</p>
                    <ul className="list-disc list-inside text-sm">
                      <li>Minted: Jan 15, 2023</li>
                      <li>Transferred to current owner: Mar 22, 2023</li>
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="blockchain" className="space-y-4 mt-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Token ID</p>
                    <p className="font-mono text-sm">{mockProperty.tokenId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Contract Address</p>
                    <div className="flex items-center">
                      <p className="font-mono text-sm truncate">{mockProperty.contractAddress}</p>
                      <Button variant="ghost" size="icon" className="ml-2">
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">View on Etherscan</span>
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Blockchain</p>
                    <p>{mockProperty.blockchain}</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline">View History</Button>
              <Button>Transfer Ownership</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
