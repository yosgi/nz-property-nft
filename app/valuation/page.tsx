"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// Mock valuation data
const mockValuation = {
  address: "123 Blockchain Ave, Crypto City, CC 12345",
  estimatedValue: 1250000,
  comparableValue: 1200000,
  lastUpdated: "October 15, 2023",
  factors: [
    { name: "Location", score: 85 },
    { name: "Property Size", score: 72 },
    { name: "Condition", score: 90 },
    { name: "Age", score: 65 },
    { name: "Renovations", score: 88 },
  ],
  historicalValues: [
    { month: "Jan", value: 1150000 },
    { month: "Feb", value: 1170000 },
    { month: "Mar", value: 1180000 },
    { month: "Apr", value: 1190000 },
    { month: "May", value: 1210000 },
    { month: "Jun", value: 1220000 },
    { month: "Jul", value: 1230000 },
    { month: "Aug", value: 1240000 },
    { month: "Sep", value: 1245000 },
    { month: "Oct", value: 1250000 },
  ],
  comparableProperties: [
    { address: "125 Blockchain Ave", value: 1230000, distance: "0.1 miles" },
    { address: "130 Blockchain Ave", value: 1280000, distance: "0.2 miles" },
    { address: "110 Token Street", value: 1190000, distance: "0.5 miles" },
  ],
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

// Calculate percentage difference
const calculateDifference = (value1: number, value2: number) => {
  const diff = ((value1 - value2) / value2) * 100
  return diff.toFixed(1)
}

export default function ValuationPage() {
  const valueDifference = calculateDifference(mockValuation.estimatedValue, mockValuation.comparableValue)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Property Valuation</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{mockValuation.address}</CardTitle>
            <CardDescription>Last updated: {mockValuation.lastUpdated}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Estimated Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(mockValuation.estimatedValue)}</div>
                  <div className="flex items-center mt-2">
                    <Badge className={Number(valueDifference) >= 0 ? "bg-green-500" : "bg-red-500"}>
                      {Number(valueDifference) >= 0 ? "+" : ""}
                      {valueDifference}%
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-2">vs. Comparable Value</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Comparable Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(mockValuation.comparableValue)}</div>
                  <div className="text-sm text-muted-foreground mt-2">Based on similar properties in the area</div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Historical Value Trend</h3>
              <div className="h-[300px]">
                <ChartContainer
                  data={mockValuation.historicalValues}
                  xAxisDataKey="month"
                  yAxisWidth={80}
                  showAnimation
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mockValuation.historicalValues}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        tickFormatter={(value) => `$${value / 1000}k`}
                        domain={[(dataMin) => dataMin * 0.95, (dataMax) => dataMax * 1.05]}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <ChartTooltip>
                                <ChartTooltipContent
                                  content={formatCurrency(payload[0].value as number)}
                                  label={payload[0].payload.month}
                                />
                              </ChartTooltip>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
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
                {mockValuation.factors.map((factor) => (
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
                {mockValuation.comparableProperties.map((property, index) => (
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
