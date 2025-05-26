"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

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

export default function MapPage() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Property Map</h1>
        <Button>Add Property</Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle>Interactive 3D Map</CardTitle>
          <CardDescription>Explore properties in an interactive 3D environment powered by CesiumJS</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-6">{isClient && <CesiumMap />}</CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">5 properties found in this area</p>
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
                <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm">Verified Properties</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-yellow-500 mr-2"></div>
                <span className="text-sm">Pending Verification</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm">For Sale</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
