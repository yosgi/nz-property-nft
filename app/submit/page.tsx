"use client"

import { useState, useEffect } from "react"
import { useContract } from "../contexts/ContractProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, CheckCircle, Upload } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Loader } from "@googlemaps/js-api-loader"
import { toast } from "sonner"

// Add Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

const NZ_PROPERTY_TYPES: Record<string, string> = {
  "house": "House",
  "apartment": "Apartment",
  "townhouse": "Townhouse",
  "unit": "Unit",
  "villa": "Villa",
  "studio": "Studio",
  "penthouse": "Penthouse",
  "duplex": "Duplex",
  "terrace": "Terrace",
  "other": "Other"
}

export default function SubmitPage() {
  const { submitProperty, connect } = useContract()
  const [formData, setFormData] = useState({
    address: "",
    ownerName: "",
    renovationDate: undefined as Date | undefined,
    propertyType: "",
    image: null as File | null,
    latitude: "",
    longitude: "",
  })
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{
    address?: string
    ownerName?: string
    renovationDate?: string
    propertyType?: string
    image?: string
    latitude?: string
    longitude?: string
  }>({})

  useEffect(() => {
    // Initialize Google Places Autocomplete
    const initGooglePlaces = async () => {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
        libraries: ["places"]
      })

      try {
        const google = await loader.load()
        const input = document.getElementById("address") as HTMLInputElement
        if (input) {
          const autocomplete = new google.maps.places.Autocomplete(input, {
            types: ["address"],
            fields: ["formatted_address", "geometry"]
          })

          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace()
            if (place.geometry?.location) {
              const geometry = place.geometry
              setFormData(prev => ({
                ...prev,
                address: place.formatted_address || "",
                latitude: geometry.location!.lat().toString(),
                longitude: geometry.location!.lng().toString()
              }))
            }
          })
        }
      } catch (error) {
        console.error("Error loading Google Places:", error)
      }
    }

    initGooglePlaces()
  }, [])

  const validateForm = () => {
    const errors: {
      address?: string
      ownerName?: string
      renovationDate?: string
      propertyType?: string
      image?: string
      latitude?: string
      longitude?: string
    } = {}

    if (!formData.address.trim()) {
      errors.address = "Property address is required"
    }
    if (!formData.ownerName.trim()) {
      errors.ownerName = "Owner name is required"
    }
    if (!formData.renovationDate) {
      errors.renovationDate = "Renovation date is required"
    }
    if (!formData.propertyType) {
      errors.propertyType = "Property type is required"
    }
    if (!formData.image) {
      errors.image = "Property image is required"
    }
    if (!formData.latitude.trim()) {
      errors.latitude = "Latitude is required"
    } else {
      const lat = parseFloat(formData.latitude)
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.latitude = "Latitude must be between -90 and 90"
      }
    }
    if (!formData.longitude.trim()) {
      errors.longitude = "Longitude is required"
    } else {
      const lng = parseFloat(formData.longitude)
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.longitude = "Longitude must be between -180 and 180"
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, propertyType: value }))
  }

  const handleDateChange = (date: Date | undefined) => {
    setFormData((prev) => ({ ...prev, renovationDate: date }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }))
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
    }
  }

  const uploadToIPFS = async (file: File): Promise<string> => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Failed to upload to IPFS: ${errorData.error || response.statusText}`)
      }

      const data = await response.json()
      return `ipfs://${data.IpfsHash}`
    } catch (error) {
      console.error('Error uploading to IPFS:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      if (!formData.image) {
        throw new Error("Please upload a property image")
      }

      // Upload image to IPFS
      const imageURI = await uploadToIPFS(formData.image)

      // Convert renovation date to Unix timestamp
      const renovationTimestamp = formData.renovationDate 
        ? Math.floor(formData.renovationDate.getTime() / 1000)
        : Math.floor(Date.now() / 1000)

      // Convert latitude and longitude to integers (multiply by 1000000)
      const latitude = Math.floor(parseFloat(formData.latitude) * 1000000)
      const longitude = Math.floor(parseFloat(formData.longitude) * 1000000)

      // Submit the property
      const tx = await submitProperty({
        propertyAddress: formData.address,
        ownerName: formData.ownerName,
        propertyType: formData.propertyType,
        renovationDate: renovationTimestamp,
        imageURI,
        latitude,
        longitude
      })

      // Wait for transaction to be mined
      await tx.wait()
      
      setIsSubmitted(true)
      toast.success("Property submitted successfully!")
    } catch (error) {
      console.error("Error submitting property:", error)
      toast.error(error instanceof Error ? error.message : "Failed to submit property")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Submit Property</h1>

      <Card className="relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              <p className="text-sm text-gray-600">
                Submitting property...
              </p>
            </div>
          </div>
        )}

        <CardHeader>
          <CardTitle>Property Information</CardTitle>
          <CardDescription>Enter the details of your property to create an NFT representation.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image">Property Image</Label>
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="image"
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Property preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-4 text-gray-500" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG or WEBP (MAX. 10MB)</p>
                    </div>
                  )}
                  <input
                    id="image"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                    required
                  />
                </label>
              </div>
              {validationErrors.image && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.image}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Property Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="Start typing an address..."
                value={formData.address}
                onChange={handleInputChange}
                required
                className={validationErrors.address ? "border-red-500" : ""}
              />
              {validationErrors.address && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.address}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerName">Owner Name</Label>
              <Input
                id="ownerName"
                name="ownerName"
                placeholder="John Doe"
                value={formData.ownerName}
                onChange={handleInputChange}
                required
                className={validationErrors.ownerName ? "border-red-500" : ""}
              />
              {validationErrors.ownerName && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.ownerName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="renovationDate">Last Renovation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.renovationDate && "text-muted-foreground",
                      validationErrors.renovationDate ? "border-red-500" : ""
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.renovationDate ? format(formData.renovationDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={formData.renovationDate} onSelect={handleDateChange} initialFocus />
                </PopoverContent>
              </Popover>
              {validationErrors.renovationDate && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.renovationDate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyType">Property Type</Label>
              <Select 
                onValueChange={handleSelectChange} 
                value={formData.propertyType}
                required
                name="propertyType"
              >
                <SelectTrigger 
                  id="propertyType"
                  className={validationErrors.propertyType ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NZ_PROPERTY_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.propertyType && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.propertyType}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading || isSubmitted}>
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting...
                </>
              ) : isSubmitted ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Submitted Successfully!
                </>
              ) : (
                "Submit Property"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
