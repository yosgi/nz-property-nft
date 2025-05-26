"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertTriangle, Wallet } from "lucide-react"

// Mock properties pending verification
const mockProperties = [
  {
    id: "prop1",
    address: "123 Blockchain Ave, Crypto City, CC 12345",
    ownerName: "Alex Blockchain",
    propertyType: "Single Family Home",
    image: "/placeholder.svg?height=200&width=300",
    submittedDate: "2023-10-15",
    votes: { approve: 12, reject: 3 },
  },
  {
    id: "prop2",
    address: "456 Token Street, NFT Town, NT 67890",
    ownerName: "Sam Crypto",
    propertyType: "Condominium",
    image: "/placeholder.svg?height=200&width=300",
    submittedDate: "2023-10-12",
    votes: { approve: 8, reject: 7 },
  },
  {
    id: "prop3",
    address: "789 Ethereum Road, Web3 City, WC 54321",
    ownerName: "Taylor DeFi",
    propertyType: "Townhouse",
    image: "/placeholder.svg?height=200&width=300",
    submittedDate: "2023-10-10",
    votes: { approve: 15, reject: 2 },
  },
]

export default function VerifyPage() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [votingProperty, setVotingProperty] = useState<string | null>(null)
  const [transactionPending, setTransactionPending] = useState(false)
  const [transactionSuccess, setTransactionSuccess] = useState<string | null>(null)

  // Simulate MetaMask connection
  const connectWallet = async () => {
    setIsConnecting(true)

    try {
      // Simulate MetaMask connection delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Mock successful connection
      setWalletConnected(true)
      setWalletAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976F")
    } catch (error) {
      console.error("Error connecting wallet:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  // Simulate voting transaction
  const submitVote = async (propertyId: string, approve: boolean) => {
    if (!walletConnected) return

    setVotingProperty(propertyId)
    setTransactionPending(true)

    try {
      // Simulate blockchain transaction delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock successful transaction
      setTransactionSuccess(approve ? "approved" : "rejected")

      // Reset after showing success message
      setTimeout(() => {
        setTransactionSuccess(null)
        setVotingProperty(null)
        setTransactionPending(false)
      }, 3000)
    } catch (error) {
      console.error("Error submitting vote:", error)
      setTransactionPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Community Verification</h1>

        {!walletConnected ? (
          <Button onClick={connectWallet} disabled={isConnecting}>
            {isConnecting ? (
              <>Connecting Wallet...</>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect MetaMask
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center">
            <Badge variant="outline" className="mr-2">
              Connected: {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setWalletConnected(false)}>
              Disconnect
            </Button>
          </div>
        )}
      </div>

      {!walletConnected && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connect your wallet</AlertTitle>
          <AlertDescription>
            You need to connect your Ethereum wallet to participate in property verification.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pending Verification</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mockProperties.map((property) => (
              <Card key={property.id}>
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-1/3">
                    <img
                      src={property.image || "/placeholder.svg"}
                      alt={property.address}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="md:w-2/3">
                    <CardHeader>
                      <CardTitle className="text-lg">{property.address}</CardTitle>
                      <CardDescription>{property.propertyType}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Owner</p>
                        <p>{property.ownerName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                        <p>{property.submittedDate}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Current Votes</p>
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                            <span>{property.votes.approve}</span>
                          </div>
                          <div className="flex items-center">
                            <XCircle className="h-4 w-4 text-red-500 mr-1" />
                            <span>{property.votes.reject}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      {votingProperty === property.id && transactionPending ? (
                        <Button disabled className="w-full">
                          Processing Transaction...
                        </Button>
                      ) : votingProperty === property.id && transactionSuccess ? (
                        <Button disabled className="w-full bg-green-500 hover:bg-green-500">
                          {transactionSuccess === "approved" ? "Approved!" : "Rejected!"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            className="flex-1 mr-2"
                            onClick={() => submitVote(property.id, false)}
                            disabled={!walletConnected}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={() => submitVote(property.id, true)}
                            disabled={!walletConnected}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                        </>
                      )}
                    </CardFooter>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Approved properties will appear here</p>
          </div>
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Rejected properties will appear here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
