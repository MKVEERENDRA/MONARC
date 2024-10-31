'use client'

import React, { useState, useEffect } from 'react'
import { useWeb3 } from '@/contexts/Web3Context'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Loader2 } from 'lucide-react'
import { uploadImageToIPFS } from '@/utils/ipfsUtils'

const globalMinRate = 500
const globalMaxRate = 2000

export default function NFTRoyaltyManager() {
  const { DynamicNFTContract, RoyaltyContract, account, IpfsHashStorageContract } = useWeb3()
  const [image, setImage] = useState(null)
  const [ipfsHash, setIpfsHash] = useState('')
  const [generatedTokenId, setGeneratedTokenId] = useState<number | null>(null)
  const [royalty, setRoyalty] = useState({
    baseRate: 1000,
    minRate: 500,
    maxRate: 2500,
    volumeMultiplier: 10,
    timeDecayFactor: 86400,
    beneficiary: '',
    lastUpdateTime: 0,
    useMarketMetrics: true,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [userNFTs, setUserNFTs] = useState([])
  const [selectedNFT, setSelectedNFT] = useState(null)
  const [previewImage, setPreviewImage] = useState("")

  useEffect(() => {
    if (account) {
      setRoyalty(prev => ({ ...prev, beneficiary: account }))
      fetchUserNFTs()
    }
  }, [account])

  const fetchUserNFTs = async () => {
    if (DynamicNFTContract && account) {
      try {
        const balance = await DynamicNFTContract.methods.balanceOf(account).call()
        const nfts = []
        for (let i = 0; i < balance; i++) {
          const tokenId = await DynamicNFTContract.methods.tokenOfOwnerByIndex(account, i).call()
          const royaltyConfig = await RoyaltyContract.methods.getRoyaltyInfo(DynamicNFTContract.options.address, tokenId).call()
          if (!royaltyConfig.baseRate) {
            nfts.push({ tokenId, needsRoyaltyConfig: true })
          }
        }
        setUserNFTs(nfts)
      } catch (err) {
        console.error('Error fetching user NFTs:', err)
      }
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setImage(file)
    setUploadingImage(true)
    setError('')
    
    try {
      const { ipfsHash, url } = await uploadImageToIPFS(file)
      setIpfsHash(ipfsHash)
      setPreviewImage(url)
      setSuccess('Image uploaded successfully to IPFS!')
      setGeneratedTokenId(null)
    } catch (err) {
      console.error('Error uploading to IPFS:', err)
      setError('Error uploading to IPFS: ' + err.message)
      setPreviewImage('')
      setIpfsHash('')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleGenerateTokenId = async () => {
    if (!ipfsHash) {
      setError('Please upload an image first to generate tokenId')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const tokenId = Number(await IpfsHashStorageContract.methods.getTotalIPFSHashes().call()) + 1
      await IpfsHashStorageContract.methods.storeIPFSHash(ipfsHash).send({ from: account })
      setGeneratedTokenId(tokenId)
      setSuccess('TokenId generated successfully!')
    } catch (err) {
      setError('Error generating tokenId: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMintNFT = async () => {
    if (!generatedTokenId) {
      setError('Please generate tokenId first')
      return
    }
    
    setLoading(true)
    try {
      await DynamicNFTContract.methods.mint(account, generatedTokenId).send({ from: account })
      setSuccess('NFT minted successfully!')
      await handleSetRoyalty(generatedTokenId)
    } catch (err) {
      setError('Error minting NFT: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSetRoyalty = async (tokenId = null) => {
    if (!tokenId && !selectedNFT && !generatedTokenId) {
      setError('Please select an NFT or generate a new one first.')
      return
    }

    const targetTokenId = tokenId || selectedNFT || generatedTokenId

    setLoading(true)
    try {
      const royaltyConfig = {
        ...royalty,
        baseRate: Math.floor(royalty.baseRate),
        minRate: Math.floor(royalty.minRate),
        maxRate: Math.floor(royalty.maxRate),
      }
      await RoyaltyContract.methods.setRoyaltyConfig(DynamicNFTContract.options.address, targetTokenId, royaltyConfig).send({ from: account })
      setSuccess('Royalty configuration set successfully!')
      fetchUserNFTs()
    } catch (err) {
      setError('Error setting royalty configuration: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">NFT Royalty Manager</h1>
      
      <Tabs defaultValue="generate">
        <TabsList className="mb-4">
          <TabsTrigger value="generate">Generate New NFT</TabsTrigger>
          <TabsTrigger value="existing">Manage Existing NFTs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generate New NFT</CardTitle>
              <CardDescription>Upload an image, generate a token ID, and set royalties for a new NFT.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <Label 
                  htmlFor="dropzone-file" 
                  className={`flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 relative ${uploadingImage ? 'pointer-events-none' : ''}`}
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Uploading to IPFS...</p>
                    </div>
                  ) : !previewImage ? (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        SVG, PNG, JPG or GIF (MAX. 800x400px)
                      </p>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="object-contain max-h-full max-w-full p-2"
                      />
                    </div>
                  )}
                  <Input 
                    id="dropzone-file" 
                    type="file" 
                    className="hidden" 
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </Label>
              </div>
              {ipfsHash && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    IPFS Hash: {ipfsHash}
                  </p>
                  <Button 
                    onClick={handleGenerateTokenId} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating TokenId...</span>
                      </div>
                    ) : (
                      'Generate TokenId'
                    )}
                  </Button>
                </div>
              )}
              {generatedTokenId !== null && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Generated TokenId: {generatedTokenId}
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleMintNFT} disabled={!generatedTokenId || loading} className="w-full">
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Minting NFT...</span>
                  </div>
                ) : (
                  'Mint NFT'
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="existing">
          <Card>
            <CardHeader>
              <CardTitle>Manage Existing NFTs</CardTitle>
              <CardDescription>Set royalty configurations for your existing NFTs without royalty settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userNFTs.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="nft-select">Select NFT</Label>
                  <select
                    id="nft-select"
                    className="w-full p-2 border rounded"
                    onChange={(e) => setSelectedNFT(e.target.value)}
                    value={selectedNFT || ''}
                  >
                    <option value="">Select an NFT</option>
                    {userNFTs.map((nft) => (
                      <option key={nft.tokenId} value={nft.tokenId}>
                        Token ID: {nft.tokenId}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p>You don't have any NFTs without royalty configurations.</p>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={() => handleSetRoyalty()} disabled={!selectedNFT || loading} className="w-full">
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting Royalty...</span>
                  </div>
                ) : (
                  'Set Royalty for Selected NFT'
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Royalty Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseRate" className="dark:text-gray-200">Base Royalty Rate</Label>
            <Slider
              id="baseRate"
              min={globalMinRate}
              max={globalMaxRate}
              step={10}
              value={[royalty.baseRate]}
              onValueChange={(value) => setRoyalty({ ...royalty, baseRate: value[0] })}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">{(royalty.baseRate / 100).toFixed(2)}%</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minRate" className="dark:text-gray-200">Minimum Royalty Rate</Label>
            <Slider
              id="minRate"
              min={globalMinRate}
              max={royalty.baseRate}
              step={10}
              value={[royalty.minRate]}
              onValueChange={(value) => setRoyalty({ ...royalty, minRate: value[0] })}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">{(royalty.minRate / 100).toFixed(2)}%</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxRate" className="dark:text-gray-200">Maximum Royalty Rate</Label>
            <Slider
              id="maxRate"
              min={royalty.baseRate}
              max={globalMaxRate}
              step={10}
              value={[royalty.maxRate]}
              onValueChange={(value) => setRoyalty({ ...royalty, maxRate:  value[0] })}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">{(royalty.maxRate / 100).toFixed(2)}%</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="beneficiary" className="dark:text-gray-200">Beneficiary Address</Label>
            <Input
              id="beneficiary"
              value={royalty.beneficiary}
              onChange={(e) => setRoyalty({ ...royalty, beneficiary: e.target.value })}
              className="dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="useMarketMetrics"
              checked={royalty.useMarketMetrics}
              onCheckedChange={(checked) => setRoyalty({ ...royalty, useMarketMetrics: checked })}
            />
            <Label htmlFor="useMarketMetrics" className="dark:text-gray-200">Use Market Metrics (Make your Royalty Dynamic with our Market Monitors)</Label>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mt-6">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}