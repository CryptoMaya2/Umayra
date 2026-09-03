import { 
  createPublicClient, 
  http, 
  formatEther, 
  formatUnits, 
  parseAbi, 
  type Address,
  type PublicClient
} from 'viem';
import { somniaShannon } from '@somnia-chain/markets-sdk/chains';
import { SOMNIA_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';

export const SOMNIA_SHANNON_CHAIN_ID = 50312;
export const SOMNIA_SHANNON_CHAIN_HEX = '0xc488';

const ERC20_BALANCE_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
]);

export interface WalletState {
  address: Address | null;
  shortAddress: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isSwitchingNetwork: boolean;
  nativeBalance: string | null; // e.g. "12.45 STT"
  usdcBalance: string | null;   // e.g. "500.00 USDC"
  error: string | null;
}

export class WalletService {
  private static publicClient: PublicClient = createPublicClient({
    chain: somniaShannon,
    transport: http('https://api.infra.testnet.somnia.network'),
  });

  /**
   * Checks if an EIP-1193 browser wallet (e.g. MetaMask, Rabby, Coinbase Wallet) is installed.
   */
  public static isWalletAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).ethereum);
  }

  /**
   * Requests user permission to connect their browser wallet and returns their address and chain.
   * Safety: ZERO transactions broadcast, ZERO signatures requested.
   */
  public static async connect(): Promise<{ address: Address; chainId: number }> {
    if (!this.isWalletAvailable()) {
      throw new Error('No browser wallet detected. Please install MetaMask, Rabby, or a compatible Web3 wallet.');
    }

    const ethereum = (window as any).ethereum;

    // Request account access
    const accounts = await ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts selected by user.');
    }

    const address = accounts[0] as Address;

    // Request current chain ID
    const chainIdHex = await ethereum.request({
      method: 'eth_chainId',
    });
    const chainId = parseInt(chainIdHex, 16);

    return { address, chainId };
  }

  /**
   * Safely prompts the user's wallet to switch to Somnia Shannon Testnet.
   * Adds the network parameters if it is not yet registered in their wallet.
   */
  public static async switchToShannonNetwork(): Promise<void> {
    if (!this.isWalletAvailable()) {
      throw new Error('No browser wallet detected.');
    }

    const ethereum = (window as any).ethereum;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SOMNIA_SHANNON_CHAIN_HEX }],
      });
    } catch (switchError: any) {
      // Error code 4902 indicates the chain has not been added to MetaMask yet.
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: SOMNIA_SHANNON_CHAIN_HEX,
              chainName: 'Somnia Shannon Testnet',
              nativeCurrency: {
                name: 'Somnia Testnet Token',
                symbol: 'STT',
                decimals: 18,
              },
              rpcUrls: [
                'https://api.infra.testnet.somnia.network',
                'https://dream-rpc.somnia.network',
              ],
              blockExplorerUrls: ['https://shannon-explorer.somnia.network'],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Fetches real on-chain native STT balance and testnet USDC collateral balance.
   */
  public static async fetchBalances(address: Address): Promise<{ nativeBalance: string; usdcBalance: string }> {
    try {
      // 1. Fetch native STT balance
      const rawNative = await this.publicClient.getBalance({ address });
      const formattedNative = parseFloat(formatEther(rawNative)).toFixed(4);
      const nativeBalance = `${formattedNative} STT`;

      // 2. Fetch testnet USDC balance
      let usdcBalance = '0.00 USDC';
      const collateralAddress = (SOMNIA_TESTNET_ADDRESSES.collateral || '0x70a86d8842fb63c4ad2b7cdddf530ebf1bb25d8e') as Address;

      try {
        const [rawUsdc, decimals] = await Promise.all([
          this.publicClient.readContract({
            address: collateralAddress,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [address],
          }),
          this.publicClient.readContract({
            address: collateralAddress,
            abi: ERC20_BALANCE_ABI,
            functionName: 'decimals',
          }).catch(() => 6),
        ]);

        const formattedUsdc = parseFloat(formatUnits(rawUsdc as bigint, decimals as number)).toFixed(2);
        usdcBalance = `${formattedUsdc} USDC`;
      } catch {
        // Fallback gracefully if testnet USDC contract read is unavailable
      }

      return { nativeBalance, usdcBalance };
    } catch (err) {
      console.warn('[WalletService] Balance fetch error:', err);
      return { nativeBalance: '0.0000 STT', usdcBalance: '0.00 USDC' };
    }
  }

  /**
   * Shortens an Ethereum address for safe display: 0x1234...5678
   */
  public static formatShortAddress(address: string | null): string {
    if (!address) return '';
    if (address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
