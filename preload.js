const { contextBridge } = require("electron");
const { ethers } = require("ethers");

// Store instances in preload context
const instances = new Map();
let instanceId = 0;

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: (url) => {
    const { shell } = require("electron");
    shell.openExternal(url);
  },
});

// Expose ethers.js API through wrapper functions
// This is necessary because contextBridge can't serialize class constructors
contextBridge.exposeInMainWorld("ethers", {
  // Create JsonRpcProvider and return instance ID
  createProvider: function (url) {
    const id = `provider_${instanceId++}`;
    const provider = new ethers.JsonRpcProvider(url);
    instances.set(id, provider);
    return id;
  },

  // Provider methods
  providerGetBlockNumber: async function (providerId) {
    const provider = instances.get(providerId);
    if (!provider) throw new Error("Provider not found");
    return await provider.getBlockNumber();
  },

  providerGetBalance: async function (providerId, address) {
    const provider = instances.get(providerId);
    if (!provider) throw new Error("Provider not found");
    return await provider.getBalance(address);
  },

  providerWaitForTransaction: async function (providerId, txHash) {
    const provider = instances.get(providerId);
    if (!provider) throw new Error("Provider not found");
    return await provider.waitForTransaction(txHash);
  },

  // Create Wallet and return instance ID
  createWallet: function (privateKey, providerId) {
    const id = `wallet_${instanceId++}`;
    const provider = instances.get(providerId);
    if (!provider) throw new Error("Provider not found");
    const wallet = new ethers.Wallet(privateKey, provider);
    instances.set(id, wallet);
    return id;
  },

  // Wallet methods
  walletGetAddress: function (walletId) {
    const wallet = instances.get(walletId);
    if (!wallet) throw new Error("Wallet not found");
    return wallet.address;
  },

  walletGetTransactionCount: async function (walletId, blockTag) {
    const wallet = instances.get(walletId);
    if (!wallet) throw new Error("Wallet not found");
    return await wallet.provider.getTransactionCount(wallet.address, blockTag);
  },

  walletSendTransaction: async function (walletId, tx) {
    const wallet = instances.get(walletId);
    if (!wallet) throw new Error("Wallet not found");
    // Use sendTransaction which handles nonce automatically
    // But we'll ensure transactions are sent sequentially
    const txResponse = await wallet.sendTransaction(tx);
    // Return serializable data
    return {
      hash: txResponse.hash,
      to: txResponse.to,
      from: txResponse.from,
      nonce: txResponse.nonce,
      gasLimit: txResponse.gasLimit?.toString(),
      gasPrice: txResponse.gasPrice?.toString(),
      value: txResponse.value?.toString(),
      data: txResponse.data,
      chainId: txResponse.chainId,
    };
  },

  // Utility functions (these work directly)
  isAddress: ethers.isAddress,
  parseEther: ethers.parseEther,
  formatEther: ethers.formatEther,
  parseUnits: ethers.parseUnits,
  formatUnits: ethers.formatUnits,
  getAddress: ethers.getAddress,
});

console.log("[preload] ethers API exposed via wrapper functions");
