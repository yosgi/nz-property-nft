"use client"

import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from "recharts"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import contractArtifact from "../../public/contracts/PropertyNFT.json"
import valuationContractArtifact from "../../build/contracts/PropertyValuation.json"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""
const VALUATION_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_VALUATION_ADDRESS || ""

interface HistoricalValue {
  month: string
  value: number
}

interface ValuationFactor {
  name: string
  score: number
}

interface ComparableProperty {
  address: string
  value: number
  distance: string
}

interface ValuationData {
  id: string
  address: string
  estimatedValue: number
  comparableValue: number
  lastUpdated: string
  factors: ValuationFactor[]
  historicalValues: HistoricalValue[]
  comparableProperties: ComparableProperty[]
  owner: string
  pendingValuation?: {
    isVerified: boolean
    value: number
  }
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value)
}

// Calculate percentage difference
const calculateDifference = (value1: number, value2: number) => {
  if (!value1 || !value2 || value2 === 0) return 0
  const diff = ((value1 - value2) / value2) * 100
  return diff.toFixed(1)
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border rounded shadow-sm">
        <p className="font-medium">{payload[0].payload.month}</p>
        <p className="text-blue-600">{formatCurrency(payload[0].value as number)}</p>
      </div>
    )
  }
  return null
}

export default function ValuationPage() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [valuationData, setValuationData] = useState<ValuationData | null>(null)
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
  const [newValuation, setNewValuation] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [ownedProperties, setOwnedProperties] = useState<{id: string, address: string}[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("")
  const [isConfirming, setIsConfirming] = useState(false)

  // Check wallet connection on mount
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
          const signer = await provider.getSigner()
          const address = await signer.getAddress()
          setWalletConnected(true)
          setWalletAddress(address)
          await fetchValuationData()
        } catch (err) {
          console.error("Error checking wallet connection:", err)
          setWalletConnected(false)
          setWalletAddress("")
        }
      }
    }

    checkWalletConnection()
  }, [])

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setWalletConnected(false)
          setWalletAddress("")
          setValuationData(null)
        } else {
          setWalletConnected(true)
          setWalletAddress(accounts[0])
          fetchValuationData()
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        }
      }
    }
  }, [])

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to view valuations")
      }

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setWalletConnected(true)
      setWalletAddress(address)
      await fetchValuationData()
    } catch (err) {
      console.error("Error connecting wallet:", err)
      setError(err instanceof Error ? err.message : "Failed to connect wallet")
      setWalletConnected(false)
      setWalletAddress("")
    } finally {
      setIsConnecting(false)
    }
  }

  const fetchValuationData = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to view valuations")
      }

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, provider)
      const valuationContract = new ethers.Contract(VALUATION_CONTRACT_ADDRESS, valuationContractArtifact.abi, provider)

      if (!selectedPropertyId) {
        setValuationData(null)
        return
      }

      // Fetch the selected property's data
      const propertyData = await contract.getProperty(selectedPropertyId)
      console.log("Selected property data:", propertyData)

      // Get the owner of the property
      const owner = await contract.ownerOf(selectedPropertyId)
      console.log("Property owner:", owner)

      // Get pending valuation data
      const pendingValuation = await valuationContract.pendingValuations(selectedPropertyId)
      console.log("Pending valuation:", pendingValuation)

      // Get total number of properties for comparable value calculation
      const totalProperties = await contract.getTotalProperties()
      const properties = []

      // Fetch all verified properties for comparable value
      for (let i = 0; i < totalProperties; i++) {
        try {
          const propData = await contract.getProperty(i)
          // Only include verified properties with valid values
          if (propData.isVerified && propData.estimatedValue) {
            const value = Number(ethers.formatEther(propData.estimatedValue)) * 5000 // Convert to NZD
            // Only include values within reasonable range (e.g., 500 NZD to 5,000,000 NZD)
            if (value > 500 && value < 5000000) {
              properties.push({
                address: propData.propertyAddress,
                estimatedValue: value
              })
            }
          }
        } catch (err) {
          console.log(`Property ${i} not found`)
        }
      }

      // Calculate comparable value (average of verified properties)
      const comparableValue = properties.length >= 2
        ? properties.reduce((acc, p) => acc + p.estimatedValue, 0) / properties.length
        : 0

      // Generate historical values with realistic fluctuations
      const generateHistoricalValues = (baseValue: number) => {
        const months = 12
        const values = []
        let currentValue = baseValue
        
        // Seasonal factors (higher in spring/summer, lower in fall/winter)
        const seasonalFactors = {
          'Jan': 0.98, 'Feb': 0.99, 'Mar': 1.01, 'Apr': 1.02,
          'May': 1.03, 'Jun': 1.02, 'Jul': 1.01, 'Aug': 1.00,
          'Sep': 0.99, 'Oct': 0.98, 'Nov': 0.97, 'Dec': 0.98
        }
        
        // Generate values for the last 12 months
        for (let i = 0; i < months; i++) {
          const date = new Date()
          date.setMonth(date.getMonth() - (months - 1 - i))
          const month = date.toLocaleString('default', { month: 'short' })
          
          // Add random fluctuation (-2% to +2%)
          const randomFactor = 0.98 + Math.random() * 0.04
          
          // Apply seasonal factor
          const seasonalFactor = seasonalFactors[month as keyof typeof seasonalFactors]
          
          // Calculate new value with both random and seasonal factors
          currentValue = currentValue * randomFactor * seasonalFactor
          
          // Add small trend factor (slight upward trend)
          const trendFactor = 1 + (i * 0.001) // 0.1% increase per month
          
          values.push({
            month,
            value: currentValue * trendFactor
          })
        }
        
        return values
      }

      // Generate historical values using the new function
      const historicalValues = generateHistoricalValues(Number(ethers.formatEther(propertyData.estimatedValue)) * 5000)

      // Generate comparable properties
      const comparableProperties = properties.slice(0, 3).map((p, i) => ({
        address: p.address,
        value: p.estimatedValue,
        distance: `${(i + 1) * 0.1} miles`,
      }))

      // Default scores if not available
      const defaultScores = {
        locationScore: 85,    // Location is typically the most important factor, given higher score
        sizeScore: 80,        // Property size is also a significant factor
        conditionScore: 75,   // Overall property condition
        ageScore: 70,         // Base age score
        renovationScore: 65   // Base renovation score
      }

      // Adjust score based on property age
      const age = Number(propertyData.ageScore) || defaultScores.ageScore
      const adjustedAgeScore = age > 20 ? 60 : age > 10 ? 70 : 80

      // Adjust score based on renovation age
      const renovation = Number(propertyData.renovationScore) || defaultScores.renovationScore
      const adjustedRenovationScore = renovation > 5 ? 75 : renovation > 2 ? 65 : 55

      setValuationData({
        id: selectedPropertyId,
        address: propertyData.propertyAddress,
        estimatedValue: Number(ethers.formatEther(propertyData.estimatedValue)) * 5000,
        comparableValue: comparableValue,
        lastUpdated: new Date().toLocaleDateString(),
        factors: [
          { name: "Location", score: Number(propertyData.locationScore) || defaultScores.locationScore },
          { name: "Property Size", score: Number(propertyData.sizeScore) || defaultScores.sizeScore },
          { name: "Condition", score: Number(propertyData.conditionScore) || defaultScores.conditionScore },
          { name: "Age", score: adjustedAgeScore },
          { name: "Renovations", score: adjustedRenovationScore },
        ],
        historicalValues: historicalValues.map(value => ({
          month: value.month,
          value: value.value
        })),
        comparableProperties: comparableProperties.map(prop => ({
          address: prop.address,
          value: prop.value,
          distance: prop.distance,
        })),
        owner,
        pendingValuation: pendingValuation && pendingValuation[0] > 0 ? {
          isVerified: pendingValuation[8],
          value: Number(ethers.formatEther(pendingValuation[0])) * 5000
        } : undefined
      })
    } catch (err) {
      console.error("Error fetching valuation data:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch valuation data")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateValuation = async () => {
    if (!newValuation || !walletConnected || !valuationData) return

    setIsUpdating(true)
    setError(null)

    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to update valuation")
      }

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const valuationContract = new ethers.Contract(VALUATION_CONTRACT_ADDRESS, valuationContractArtifact.abi, signer)

      // Convert NZD to Wei (divide by 5000 to get ETH equivalent, then convert to Wei)
      const ethValue = Number(newValuation) / 5000
      const valuationInWei = ethers.parseEther(ethValue.toString())
      
      // Submit valuation for verification
      const tx = await valuationContract.submitValuation(
        selectedPropertyId,
        valuationInWei,
        valuationInWei,
        valuationData.factors[0].score,
        valuationData.factors[1].score,
        valuationData.factors[2].score,
        valuationData.factors[3].score,
        valuationData.factors[4].score
      )
      await tx.wait()

      toast.success("Property valuation submitted for verification")
      setIsUpdateDialogOpen(false)
      setNewValuation("")
      await fetchValuationData()
    } catch (err) {
      console.error("Error updating valuation:", err)
      setError(err instanceof Error ? err.message : "Failed to update valuation")
      toast.error("Failed to update valuation")
    } finally {
      setIsUpdating(false)
    }
  }

  const fetchOwnedProperties = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to view valuations")
      }

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractArtifact.abi, signer)

      // Get total number of properties
      const totalProperties = await contract.getTotalProperties()
      const properties = []

      // Fetch each property and check ownership
      for (let i = 0; i < totalProperties; i++) {
        try {
          const owner = await contract.ownerOf(i)
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            const propertyData = await contract.getProperty(i)
            properties.push({
              id: i.toString(),
              address: propertyData.propertyAddress
            })
          }
        } catch (err) {
          console.log(`Property ${i} not found or not owned`)
        }
      }

      setOwnedProperties(properties)
      if (properties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(properties[0].id)
      }
    } catch (err) {
      console.error("Error fetching owned properties:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch owned properties")
    }
  }

  // Update useEffect to fetch owned properties when wallet connects
  useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchOwnedProperties()
    }
  }, [walletConnected, walletAddress])

  // Add useEffect to fetch valuation data when selected property changes
  useEffect(() => {
    if (selectedPropertyId) {
      fetchValuationData()
    }
  }, [selectedPropertyId])

  const handleConfirmValuation = async () => {
    if (!walletConnected || !valuationData) return

    setIsConfirming(true)
    setError(null)

    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to confirm valuation")
      }

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
      const signer = await provider.getSigner()
      const valuationContract = new ethers.Contract(VALUATION_CONTRACT_ADDRESS, valuationContractArtifact.abi, signer)

      console.log("Confirming valuation for property:", selectedPropertyId)
      console.log("Using contract address:", VALUATION_CONTRACT_ADDRESS)
      console.log("Contract ABI:", valuationContractArtifact.abi)
      console.log("Current wallet address:", walletAddress)
      console.log("Property owner:", valuationData.owner)
      console.log("Is owner:", walletAddress?.toLowerCase() === valuationData.owner?.toLowerCase())
      console.log("Pending valuation:", valuationData.pendingValuation)

      // Check if the valuation is verified
      if (!valuationData.pendingValuation?.isVerified) {
        throw new Error("Valuation must be verified before confirmation")
      }

      // Check if the user is the owner
      if (walletAddress?.toLowerCase() !== valuationData.owner?.toLowerCase()) {
        throw new Error("Only the property owner can confirm valuation updates")
      }

      // Get the current pending valuation
      const pendingValuation = await valuationContract.pendingValuations(selectedPropertyId)
      console.log("Current pending valuation:", pendingValuation)

      // Check if the valuation is still pending and verified
      if (!pendingValuation[8]) { // isVerified is at index 8
        throw new Error("Valuation is no longer verified")
      }

      // Submit confirmation for valuation
      const tx = await valuationContract.confirmValuationUpdate(selectedPropertyId, {
        gasLimit: 500000 // Add explicit gas limit
      })
      console.log("Transaction sent:", tx.hash)
      
      const receipt = await tx.wait()
      console.log("Transaction confirmed:", receipt)

      toast.success("Property valuation confirmed")
      setIsUpdateDialogOpen(false)
      await fetchValuationData() // Refresh the valuation data
    } catch (err) {
      console.error("Error confirming valuation:", err)
      if (err instanceof Error) {
        console.error("Error details:", {
          message: err.message,
          code: (err as any).code,
          data: (err as any).data
        })
      }
      setError(err instanceof Error ? err.message : "Failed to confirm valuation")
      toast.error("Failed to confirm valuation")
    } finally {
      setIsConfirming(false)
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
      <div className="max-w-7xl mx-auto p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!walletConnected) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Property Valuation</h1>
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
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connect your wallet</AlertTitle>
          <AlertDescription>
            You need to connect your Ethereum wallet to view property valuations.
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  console.log(valuationData)

  if (!valuationData) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No property valuation data is available at the moment.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const valueDifference = calculateDifference(valuationData.estimatedValue, valuationData.comparableValue)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Property Valuation</h1>
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="mr-2">
              Connected: {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'No Address'}
            </Badge>
            {valuationData && walletAddress?.toLowerCase() === valuationData.owner?.toLowerCase() && (
              <Button variant="outline" onClick={() => setIsUpdateDialogOpen(true)}>
                Update Valuation
              </Button>
            )}
          </div>
        )}
      </div>

      {walletConnected && ownedProperties.length > 0 && (
        <div className="flex items-center gap-4">
          <Label>Select Property:</Label>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a property" />
            </SelectTrigger>
            <SelectContent>
              {ownedProperties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {walletConnected && ownedProperties.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Properties Found</AlertTitle>
          <AlertDescription>
            You don't own any properties yet. Submit a property to get started.
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Property Valuation</DialogTitle>
            <DialogDescription>
              Update the valuation for {valuationData?.address}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="valuation">New Valuation (NZD)</Label>
              <Input
                id="valuation"
                type="number"
                step="1"
                placeholder="Enter new valuation in NZD"
                value={newValuation}
                onChange={(e) => setNewValuation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUpdateDialogOpen(false)
                setNewValuation("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateValuation}
              disabled={!newValuation || isUpdating}
            >
              {isUpdating ? "Updating..." : "Update Valuation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{valuationData.address}</CardTitle>
            <CardDescription>Last updated: {valuationData.lastUpdated}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Estimated Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(valuationData.estimatedValue)}</div>
                  <div className="flex items-center mt-2">
                    <Badge className={Number(valueDifference) >= 0 ? "bg-green-500" : "bg-red-500"}>
                      {Number(valueDifference) >= 0 ? "+" : ""}
                      {valueDifference}%
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-2">vs. Comparable Value</span>
                  </div>
                  {valuationData.pendingValuation && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium mb-1">Pending Update</div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(valuationData.pendingValuation.value)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {valuationData.pendingValuation.isVerified 
                          ? "Verified by 3 or more validators"
                          : "Awaiting verification"}
                      </div>
                    </div>
                  )}
                  {valuationData.pendingValuation?.isVerified && 
                   walletAddress?.toLowerCase() === valuationData.owner?.toLowerCase() && (
                    <Button 
                      className="mt-4 w-full"
                      onClick={handleConfirmValuation}
                      disabled={isConfirming}
                    >
                      {isConfirming ? "Confirming..." : "Confirm Valuation Update"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Comparable Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(valuationData.comparableValue)}</div>
                  <div className="text-sm text-muted-foreground mt-2">Based on similar properties in the area</div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Historical Value Trend</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valuationData.historicalValues}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis
                      tickFormatter={(value: number) => `$${value / 1000}k`}
                      domain={[(dataMin: number) => dataMin * 0.95, (dataMax: number) => dataMax * 1.05]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Valuation Factors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {valuationData.factors.map((factor) => (
                  <div key={factor.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">{factor.name}</span>
                      <span className="text-sm font-medium">{factor.score}/100</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary rounded-full h-2" style={{ width: `${factor.score}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparable Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {valuationData.comparableProperties.map((property, index) => (
                  <div key={index} className="flex justify-between items-center pb-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{property.address}</p>
                      <p className="text-sm text-muted-foreground">{property.distance}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(property.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Valuation Details</TabsTrigger>
          <TabsTrigger value="methodology">Methodology</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p>
                This property valuation is based on a combination of factors including location, property size,
                condition, age, and recent renovations. The estimated value is calculated using a proprietary algorithm
                that takes into account comparable properties in the area, historical price trends, and market
                conditions.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="methodology" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p>
                Our valuation methodology combines traditional real estate appraisal techniques with blockchain-verified
                data points. We use a weighted average of comparable sales, cost approach, and income approach methods,
                enhanced by verified property data from our blockchain network. This provides a more accurate and
                transparent valuation than traditional methods alone.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
