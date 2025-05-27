"use client"

import type React from "react"
import type { EthereumProvider } from "../types/ethereum"
import { useState } from "react"
import { ethers } from "ethers"
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

// Import the contract ABI
import contractArtifact from "../../build/contracts/PropertyNFT.json"

// Add contract ABI and address
const contractABI = contractArtifact.abi
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROPERTY_NFT_ADDRESS || ""

export default function SubmitPage() {
  const [formData, setFormData] = useState({
    address: "",
    ownerName: "",
    renovationDate: undefined as Date | undefined,
    propertyType: "",
    image: null as File | null,
  })
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{
    address?: string;
    ownerName?: string;
    renovationDate?: string;
    propertyType?: string;
    image?: string;
  }>({})

  const validateForm = () => {
    const errors: {
      address?: string;
      ownerName?: string;
      renovationDate?: string;
      propertyType?: string;
      image?: string;
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
    setError(null)

    try {
      if (!formData.image) {
        throw new Error("Please upload a property image")
      }

      // Check if MetaMask is installed
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to use this feature")
      }

      // Upload image to IPFS
      const imageURI = await uploadToIPFS(formData.image)

      // Request account access
      await (window.ethereum as EthereumProvider).request({ method: "eth_requestAccounts" })
      const provider = new ethers.BrowserProvider(window.ethereum as EthereumProvider)
      const signer = await provider.getSigner()
      const ownerAddress = await signer.getAddress()

      // Create contract instance
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)

      // Convert renovation date to Unix timestamp
      const renovationTimestamp = formData.renovationDate 
        ? Math.floor(formData.renovationDate.getTime() / 1000)
        : Math.floor(Date.now() / 1000)

      // Submit the property
      const tx = await contract.submitProperty(
        formData.address,
        formData.ownerName,
        formData.propertyType,
        renovationTimestamp,
        imageURI
      )

      // Wait for transaction to be mined
      const receipt = await tx.wait()
      
      // Get the PropertySubmitted event
      const event = receipt.logs.find(
        (log: any) => log.fragment && log.fragment.name === "PropertySubmitted"
      )
      
      if (event) {
        console.log("Property submitted successfully!", {
          tokenId: event.args.tokenId.toString(),
          owner: ownerAddress,
          address: formData.address
        })
      }
      
      setIsSubmitted(true)
    } catch (err) {
      console.error("Error submitting property:", err)
      setError(err instanceof Error ? err.message : "Failed to submit property")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Submit Property</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <Card>
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
                placeholder="123 Main St, City, State, ZIP"
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
              >
                <SelectTrigger 
                  id="propertyType"
                  className={validationErrors.propertyType ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single-family">Single Family Home</SelectItem>
                  <SelectItem value="condo">Condominium</SelectItem>
                  <SelectItem value="townhouse">Townhouse</SelectItem>
                  <SelectItem value="multi-family">Multi-Family</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="land">Land</SelectItem>
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
