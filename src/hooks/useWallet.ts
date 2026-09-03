import { useState, useEffect, useCallback } from 'react';
import type { Address } from 'viem';
import { WalletService, SOMNIA_SHANNON_CHAIN_ID, type WalletState } from '../services/walletService';

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    shortAddress: null,
    chainId: null,
    isCorrectNetwork: false,
    isConnected: false,
    isConnecting: false,
    isSwitchingNetwork: false,
    nativeBalance: null,
    usdcBalance: null,
    error: null,
  });

  const refreshBalances = useCallback(async (address: Address) => {
    try {
      const { nativeBalance, usdcBalance } = await WalletService.fetchBalances(address);
      setState((prev) => ({
        ...prev,
        nativeBalance,
        usdcBalance,
      }));
    } catch {
      // Degrade gracefully
    }
  }, []);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const { address, chainId } = await WalletService.connect();
      const isCorrectNetwork = chainId === SOMNIA_SHANNON_CHAIN_ID;
      const shortAddress = WalletService.formatShortAddress(address);

      setState((prev) => ({
        ...prev,
        address,
        shortAddress,
        chainId,
        isCorrectNetwork,
        isConnected: true,
        isConnecting: false,
        error: null,
      }));

      // Fetch balances if on Shannon network
      if (isCorrectNetwork) {
        refreshBalances(address);
      }
    } catch (err: any) {
      console.warn('[useWallet] Connection error:', err);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err?.message || 'Failed to connect wallet',
      }));
    }
  }, [refreshBalances]);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      shortAddress: null,
      chainId: null,
      isCorrectNetwork: false,
      isConnected: false,
      isConnecting: false,
      isSwitchingNetwork: false,
      nativeBalance: null,
      usdcBalance: null,
      error: null,
    });
  }, []);

  const switchNetwork = useCallback(async () => {
    setState((prev) => ({ ...prev, isSwitchingNetwork: true, error: null }));
    try {
      await WalletService.switchToShannonNetwork();
      setState((prev) => ({
        ...prev,
        chainId: SOMNIA_SHANNON_CHAIN_ID,
        isCorrectNetwork: true,
        isSwitchingNetwork: false,
      }));
      if (state.address) {
        refreshBalances(state.address);
      }
    } catch (err: any) {
      console.warn('[useWallet] Network switch error:', err);
      setState((prev) => ({
        ...prev,
        isSwitchingNetwork: false,
        error: err?.message || 'Failed to switch network to Somnia Shannon testnet',
      }));
    }
  }, [state.address, refreshBalances]);

  // Listen for account and chain changes from browser wallet
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    const ethereum = (window as any).ethereum;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        disconnect();
      } else {
        const newAddress = accounts[0] as Address;
        const shortAddress = WalletService.formatShortAddress(newAddress);
        setState((prev) => ({
          ...prev,
          address: newAddress,
          shortAddress,
          isConnected: true,
        }));
        refreshBalances(newAddress);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      const isCorrectNetwork = newChainId === SOMNIA_SHANNON_CHAIN_ID;
      setState((prev) => ({
        ...prev,
        chainId: newChainId,
        isCorrectNetwork,
      }));
      if (state.address && isCorrectNetwork) {
        refreshBalances(state.address);
      }
    };

    if (ethereum.on) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [disconnect, refreshBalances, state.address]);

  return {
    ...state,
    isWalletAvailable: WalletService.isWalletAvailable(),
    connect,
    disconnect,
    switchNetwork,
    refreshBalances,
  };
}
