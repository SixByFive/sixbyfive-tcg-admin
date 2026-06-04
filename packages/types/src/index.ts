export interface AdminUser {
  id: string
  username: string
  email: string
  role: string
  subscriptionTier: string | null
  isSuspended: boolean
  isVerified: boolean
  walletBalance: number
  createdAt: string
}

export interface AdminOrder {
  id: string
  buyerId: string
  sellerId: string
  status: string
  fulfilmentStatus: string
  paymentStatus: string
  totalPricePence: number
  createdAt: string
  buyer?: { username: string }
  seller?: { username: string }
}

export interface AdminTrade {
  id: string
  partyAId: string
  partyBId: string
  status: string
  createdAt: string
  partyA?: { username: string }
  partyB?: { username: string }
}

export interface AdminListing {
  id: string
  sellerId: string
  cardName: string
  price: number
  status: string
  isSuspended: boolean
  createdAt: string
  seller?: { username: string }
}

export interface AuthUser {
  id: string
  username: string
  email: string
  role: string
}
