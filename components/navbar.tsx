"use client"

import { useState, useEffect } from "react"
import { ethers } from "ethers"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Wallet, Home, Map, FileCheck, AlertCircle, Network } from "lucide-react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const TARGET_NETWORK_ID = process.env.NEXT_PUBLIC_NETWORK_ID || "1337"

type EthereumProvider = {
  on: (event: string, callback: (...args: any[]) => void) => void
  removeListener: (event: string, callback: (...args: any[]) => void) => void
  request: (args: { method: string; params?: any[] }) => Promise<any>
  send: (method: string, params?: any[]) => Promise<any>
}

export default function Navbar() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [currentNetworkId, setCurrentNetworkId] = useState<string | null>(null)
  const [isNetworkMismatch, setIsNetworkMismatch] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/submit", label: "Submit" },
    { href: "/nft", label: "NFT" },
    { href: "/map", label: "Map" },
    { href: "/verify", label: "Verify" },
    { href: "/valuation", label: "My Properties" },
  ]

  const getNetworkName = (chainId: string) => {
    switch (chainId) {
      // Mainnet
      case "1":
        return "Ethereum Mainnet"
      // Testnets
      case "5":
        return "Goerli"
      case "11155111":
        return "Sepolia"
      // Layer 2
      case "10":
        return "Optimism"
      case "137":
        return "Polygon"
      case "42161":
        return "Arbitrum One"
      case "42170":
        return "Arbitrum Nova"
      case "8453":
        return "Base"
      // Development
      case "1337":
        return "Ganache"
      case "31337":
        return "Hardhat"
      // Other common networks
      case "56":
        return "BNB Chain"
      case "100":
        return "Gnosis"
      case "250":
        return "Fantom"
      case "43114":
        return "Avalanche"
      case "42220":
        return "Celo"
      default:
        return `Chain ${chainId}`
    }
  }

  useEffect(() => {
    checkWalletConnection()
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)
      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum?.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [])

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.listAccounts()
        if (accounts.length > 0) {
          setWalletConnected(true)
          setWalletAddress(accounts[0].address)
          const network = await provider.getNetwork()
          setCurrentNetworkId(network.chainId.toString())
          setIsNetworkMismatch(network.chainId.toString() !== TARGET_NETWORK_ID)
        }
      } catch (error) {
        console.error("Error checking wallet connection:", error)
      }
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setWalletConnected(false)
      setWalletAddress("")
    } else {
      setWalletConnected(true)
      setWalletAddress(accounts[0])
    }
  }

  const handleChainChanged = (chainId: string) => {
    setCurrentNetworkId(chainId)
    setIsNetworkMismatch(chainId !== TARGET_NETWORK_ID)
    window.location.reload()
  }

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.send("eth_requestAccounts", [])
        setWalletConnected(true)
        setWalletAddress(accounts[0])
        const network = await provider.getNetwork()
        setCurrentNetworkId(network.chainId.toString())
        setIsNetworkMismatch(network.chainId.toString() !== TARGET_NETWORK_ID)
      } catch (error) {
        console.error("Error connecting wallet:", error)
        toast.error("Failed to connect wallet")
      }
    } else {
      toast.error("Please install MetaMask")
    }
  }

  const switchNetwork = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${parseInt(TARGET_NETWORK_ID).toString(16)}` }],
        })
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${parseInt(TARGET_NETWORK_ID).toString(16)}`,
                  chainName: TARGET_NETWORK_ID === "1337" ? "Local Ganache" : "Sepolia Testnet",
                  nativeCurrency: {
                    name: "ETH",
                    symbol: "ETH",
                    decimals: 18,
                  },
                  rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545"],
                },
              ],
            })
          } catch (addError) {
            console.error("Error adding network:", addError)
            toast.error("Failed to add network")
          }
        } else {
          console.error("Error switching network:", switchError)
          toast.error("Failed to switch network")
        }
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">PropertyNFT</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === item.href ? "text-foreground" : "text-foreground/60",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="ml-auto flex items-center space-x-4">
          {currentNetworkId && (
            <div className={cn(
              "flex items-center space-x-2 text-sm",
              isNetworkMismatch ? "text-destructive" : "text-muted-foreground"
            )}>
              <Network className="h-4 w-4" />
              <span>
                {getNetworkName(currentNetworkId)}
                {isNetworkMismatch && (
                  <span className="ml-1">
                    (Target: {getNetworkName(TARGET_NETWORK_ID)})
                  </span>
                )}
              </span>
            </div>
          )}
          {isNetworkMismatch && (
            <Button
              variant="destructive"
              className="flex items-center space-x-2"
              onClick={switchNetwork}
            >
              <AlertCircle className="h-4 w-4" />
              <span>Switch Network</span>
            </Button>
          )}
          {walletConnected ? (
            <div className="flex items-center space-x-2">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </div>
          ) : (
            <Button onClick={connectWallet} className="flex items-center space-x-2">
              <Wallet className="h-4 w-4" />
              <span>Connect Wallet</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
