export interface PropertyData {
  tokenId: bigint
  propertyAddress: string
  ownerName: string
  propertyType: string
  renovationDate: bigint
  tokenURI: string
  imageURI: string
  isVerified: boolean
  estimatedValue: bigint
  currentOwner: string
  latitude: bigint
  longitude: bigint
  verificationVotes: bigint
  rejectionVotes: bigint
  valuationHistory: any[]
  verificationHistory: any[]
  transactionHistory: any[]
  locationScore: number
  sizeScore: number
  conditionScore: number
  ageScore: number
  renovationScore: number
  pendingValuation?: {
    value: bigint
    isVerified: boolean
  }
}

// Pagination result type
export interface PaginationResult {
  properties: PropertyData[]
  totalCount: number
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}