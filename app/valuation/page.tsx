"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from "recharts"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Wallet, CheckCircle, XCircle, Check, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { useContract } from "../contexts/ContractProvider"
import { PropertyData } from "../types/property"

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
  isVerified: boolean
  pendingValuation?: {
    isVerified: boolean
    value: number
    comparableValue: number
    votes: number
    rejections: number
    canConfirm: boolean
    lastUpdated: string
    scores: {
      location: number
      size: number
      condition: number
      age: number
      renovation: number
    }
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

// Loading overlay component
const LoadingOverlay = ({ message }: { message: string }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-lg font-medium">{message}</p>
    </div>
  </div>
)

// Error overlay component
const ErrorOverlay = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center gap-4 max-w-md">
      <XCircle className="h-12 w-12 text-red-500" />
      <p className="text-lg font-medium text-center">{message}</p>
      <Button onClick={onClose} variant="outline">
        Close
      </Button>
    </div>
  </div>
)

export default function ValuationPage() {
  // Use contract context
  const { 
    isReady, 
    address, 
    connect, 
    getPropertiesWithPagination, 
    getProperty, 
    submitValuation,
    propertyValuation,
    transactionPending 
  } = useContract()

  // Local state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [valuationData, setValuationData] = useState<ValuationData | null>(null)
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
  const [newValuation, setNewValuation] = useState("")
  const [ownedProperties, setOwnedProperties] = useState<{id: string, address: string}[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("")
  const [updateReason, setUpdateReason] = useState("")
  const [renovationDetails, setRenovationDetails] = useState("")
  const [renovationDate, setRenovationDate] = useState("")
  const [locationScore, setLocationScore] = useState(85)
  const [sizeScore, setSizeScore] = useState(80)
  const [conditionScore, setConditionScore] = useState(75)
  const [ageScore, setAgeScore] = useState(70)
  const [renovationScore, setRenovationScore] = useState(65)

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

  // Fetch owned properties using contract provider
  const fetchOwnedProperties = async () => {
    if (!isReady || !address) return

    try {
      setLoading(true)
      
      // Get properties owned by current user
      const result = await getPropertiesWithPagination({
        page: 1,
        limit: 100, // Get all properties for the user
        owner: address
      })

      const properties = result.properties.map(prop => ({
        id: prop.tokenId.toString(),
        address: prop.propertyAddress
      }))

      setOwnedProperties(properties)
      
      // Auto-select first property if none selected
      if (properties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(properties[0].id)
      }
    } catch (err) {
      console.error("Error fetching owned properties:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch owned properties")
    } finally {
      setLoading(false)
    }
  }

  // Fetch valuation data for selected property
  const fetchValuationData = async () => {
    if (!isReady || !selectedPropertyId || !propertyValuation) return

    try {
      setLoading(true)
      setError(null)

      // Get the selected property's data
      const property = await getProperty(selectedPropertyId)
      
      // Get all verified properties for comparable value calculation
      const allPropertiesResult = await getPropertiesWithPagination({
        page: 1,
        limit: 100,
        verifiedOnly: true
      })

      const verifiedProperties = allPropertiesResult.properties
        .filter(p => p.estimatedValue > 0)
        .map(p => ({
          address: p.propertyAddress,
          estimatedValue: Number(p.estimatedValue) / 1e18 * 500000 // Convert from Wei to NZD
        }))
        .filter(p => p.estimatedValue > 50000 && p.estimatedValue < 5000000) // Reasonable range

      // Calculate comparable value (average of verified properties)
      const comparableValue = verifiedProperties.length >= 2
        ? verifiedProperties.reduce((acc, p) => acc + p.estimatedValue, 0) / verifiedProperties.length
        : 0

      // Convert property estimated value from Wei to NZD
      const propertyValueNZD = Number(property.estimatedValue) / 1e18 * 500000

      // Generate historical values
      const historicalValues = generateHistoricalValues(propertyValueNZD)

      // Generate comparable properties (first 3)
      const comparableProperties = verifiedProperties.slice(0, 3).map((p, i) => ({
        address: p.address,
        value: p.estimatedValue,
        distance: `${(i + 1) * 0.1} km`,
      }))

      // Use property scores if available, otherwise use defaults
      const factors = [
        { name: "Location", score: property.locationScore || locationScore },
        { name: "Property Size", score: property.sizeScore || sizeScore },
        { name: "Condition", score: property.conditionScore || conditionScore },
        { name: "Age", score: property.ageScore || ageScore },
        { name: "Renovations", score: property.renovationScore || renovationScore },
      ]

      // Check for pending valuation
      let pendingValuation = undefined
      try {
        const pendingVal = await propertyValuation.getPendingValuation(Number(selectedPropertyId))
        
        if (pendingVal && Number(pendingVal.estimatedValue) > 0) {
          // Check if user can confirm (owner + verified)
          const isOwner = address?.toLowerCase() === property.currentOwner.toLowerCase()
          const canConfirm = isOwner && pendingVal.isVerified
          
          pendingValuation = {
            isVerified: pendingVal.isVerified,
            value: Number(pendingVal.estimatedValue) / 1e18 * 500000, // Convert to NZD
            comparableValue: Number(pendingVal.comparableValue) / 1e18 * 500000,
            votes: Number(pendingVal.verificationVotes),
            rejections: Number(pendingVal.rejectionVotes),
            canConfirm: canConfirm,
            lastUpdated: new Date(Number(pendingVal.lastUpdated) * 1000).toLocaleDateString(),
            scores: {
              location: Number(pendingVal.locationScore),
              size: Number(pendingVal.sizeScore),
              condition: Number(pendingVal.conditionScore),
              age: Number(pendingVal.ageScore),
              renovation: Number(pendingVal.renovationScore)
            }
          }
        }
      } catch (error) {
        console.log("No pending valuation found")
      }

      setValuationData({
        id: selectedPropertyId,
        address: property.propertyAddress,
        estimatedValue: propertyValueNZD,
        comparableValue: comparableValue,
        lastUpdated: new Date().toLocaleDateString(),
        factors,
        historicalValues,
        comparableProperties,
        owner: property.currentOwner,
        isVerified: property.isVerified,
        pendingValuation
      })

    } catch (err) {
      console.error("Error fetching valuation data:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch valuation data"
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // Handle valuation confirmation
  const handleConfirmValuation = async () => {
    if (!isReady || !valuationData?.pendingValuation || !propertyValuation) return

    try {
      setLoading(true)
      
      // Call confirmValuationUpdate on the valuation contract
      const tx = await propertyValuation.confirmValuationUpdate(Number(selectedPropertyId))
      await tx.wait()
      
      toast.success("Valuation confirmed and updated successfully!")
      
      // Refresh data to show updated values
      await fetchValuationData()
    } catch (err) {
      console.error("Error confirming valuation:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to confirm valuation"
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }
  const handleUpdateValuation = async () => {
    if (!newValuation || !isReady || !valuationData) return

    try {
      // Check if property is verified
      if (!valuationData.isVerified) {
        toast.error("Only verified properties can be updated")
        return
      }

      // Convert NZD to Wei (divide by 500000 to get ETH equivalent, then convert to Wei)
      const ethValue = Number(newValuation) / 500000
      const valuationInWei = Math.floor(ethValue * 1e18)
      
      await submitValuation({
        tokenId: Number(selectedPropertyId),
        estimatedValue: valuationInWei,
        comparableValue: valuationInWei,
        locationScore,
        sizeScore,
        conditionScore,
        ageScore,
        renovationScore
      })

      toast.success("Property valuation submitted for verification")
      setIsUpdateDialogOpen(false)
      setNewValuation("")
      setUpdateReason("")
      setRenovationDetails("")
      setRenovationDate("")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update valuation"
      setError(errorMsg)
      toast.error(errorMsg)
    }
  }

  // Effect to fetch owned properties when wallet connects
  useEffect(() => {
    if (isReady && address) {
      fetchOwnedProperties()
    }
  }, [isReady, address])

  // Effect to fetch valuation data when selected property changes
  useEffect(() => {
    if (selectedPropertyId && isReady && propertyValuation) {
      fetchValuationData()
    }
  }, [selectedPropertyId, isReady, propertyValuation])

  // Show loading overlay during transactions
  if (transactionPending) {
    return <LoadingOverlay message="Processing blockchain transaction..." />
  }

  // Show loading overlay while fetching data
  if (loading) {
    return <LoadingOverlay message="Loading valuation data..." />
  }

  // Show error overlay
  if (error) {
    return (
      <ErrorOverlay 
        message={error} 
        onClose={() => setError(null)} 
      />
    )
  }

  // Show connect wallet prompt
  if (!isReady) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Property Valuation</h1>
          <Button onClick={connect}>
            <Wallet className="mr-2 h-4 w-4" />
            Connect MetaMask
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

  // Show no properties message
  if (ownedProperties.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Property Valuation</h1>
          <Badge variant="outline">
            Connected: {address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'No Address'}
          </Badge>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Properties Found</AlertTitle>
          <AlertDescription>
            You don't own any properties yet. Submit a property to get started.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Show no data message if no valuation data
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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="mr-2">
            Connected: {address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'No Address'}
          </Badge>
          {valuationData && address?.toLowerCase() === valuationData.owner?.toLowerCase() && (
            <Button variant="outline" onClick={() => setIsUpdateDialogOpen(true)}>
              Update Valuation
            </Button>
          )}
        </div>
      </div>

      {/* Property selector */}
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

      {/* Update valuation dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-2xl">
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

            <div className="grid gap-2">
              <Label htmlFor="updateReason">Reason for Update</Label>
              <Textarea
                id="updateReason"
                placeholder="Enter the reason for this valuation update"
                value={updateReason}
                onChange={(e) => setUpdateReason(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="renovationDetails">Renovation Details</Label>
              <Textarea
                id="renovationDetails"
                placeholder="Describe any renovations or improvements made to the property"
                value={renovationDetails}
                onChange={(e) => setRenovationDetails(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="renovationDate">Renovation Date</Label>
              <Input
                id="renovationDate"
                type="date"
                value={renovationDate}
                onChange={(e) => setRenovationDate(e.target.value)}
              />
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Location Score: {locationScore}</Label>
                <Slider
                  value={[locationScore]}
                  onValueChange={(value) => setLocationScore(value[0])}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <Label>Property Size Score: {sizeScore}</Label>
                <Slider
                  value={[sizeScore]}
                  onValueChange={(value) => setSizeScore(value[0])}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <Label>Condition Score: {conditionScore}</Label>
                <Slider
                  value={[conditionScore]}
                  onValueChange={(value) => setConditionScore(value[0])}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <Label>Age Score: {ageScore}</Label>
                <Slider
                  value={[ageScore]}
                  onValueChange={(value) => setAgeScore(value[0])}
                  max={100}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <Label>Renovation Score: {renovationScore}</Label>
                <Slider
                  value={[renovationScore]}
                  onValueChange={(value) => setRenovationScore(value[0])}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUpdateDialogOpen(false)
                setNewValuation("")
                setUpdateReason("")
                setRenovationDetails("")
                setRenovationDate("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateValuation}
              disabled={!newValuation}
            >
              Update Valuation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main content */}
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
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium text-blue-800">Pending Valuation Update</div>
                        <div className="flex items-center gap-2">
                          {valuationData.pendingValuation.isVerified && (
                            <Badge className="bg-green-100 text-green-800">✓ Verified</Badge>
                          )}
                          {!valuationData.pendingValuation.isVerified && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800">
                              Awaiting Verification
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 font-medium">New Value:</span>
                          <div className="text-lg font-bold text-blue-800">
                            {formatCurrency(valuationData.pendingValuation.value)}
                          </div>
                        </div>
                        <div>
                          <span className="text-blue-700 font-medium">Comparable:</span>
                          <div className="text-lg font-bold text-blue-800">
                            {formatCurrency(valuationData.pendingValuation.comparableValue)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2 text-xs text-blue-600">
                        <div>Location: {valuationData.pendingValuation.scores.location}/100</div>
                        <div>Size: {valuationData.pendingValuation.scores.size}/100</div>
                        <div>Condition: {valuationData.pendingValuation.scores.condition}/100</div>
                        <div>Age: {valuationData.pendingValuation.scores.age}/100</div>
                        <div>Renovation: {valuationData.pendingValuation.scores.renovation}/100</div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-blue-600">
                        <span>Votes: {valuationData.pendingValuation.votes} | Rejections: {valuationData.pendingValuation.rejections}</span>
                        <span>Updated: {valuationData.pendingValuation.lastUpdated}</span>
                      </div>

                      {valuationData.pendingValuation.isVerified && 
                       address?.toLowerCase() === valuationData.owner?.toLowerCase() && (
                        <div className="pt-2 border-t border-blue-200">
                          <Button 
                            onClick={handleConfirmValuation}
                            className="w-full bg-green-600 hover:bg-green-700"
                            disabled={loading}
                          >
                            {loading ? "Confirming..." : "Confirm Valuation Update"}
                          </Button>
                          <p className="text-xs text-blue-600 mt-1 text-center">
                            This will update your property's official valuation
                          </p>
                        </div>
                      )}

                      {!valuationData.pendingValuation.isVerified && (
                        <div className="text-xs text-blue-600 text-center">
                          Waiting for {3 - valuationData.pendingValuation.votes} more votes to verify
                        </div>
                      )}
                    </div>
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