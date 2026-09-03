import React, { useState } from 'react';
import { ArrowLeft, Globe2, Wallet, AlertTriangle, Coins } from 'lucide-react';
import { LandingPage } from './pages/LandingPage';
import { ConversationalInterface } from './components/ConversationalInterface';
import { UmayraLogo } from './components/UmayraLogo';
import { WalletProvider, useWalletContext } from './context/WalletContext';
import { PositionsDrawer } from './components/PositionsDrawer';
import { usePositions } from './hooks/usePositions';

type AppPage = 'landing' | 'app';

const AppShell: React.FC<{ onBackToLanding: () => void }> = ({ onBackToLanding }) => {
  const wallet = useWalletContext();
  const [isPositionsOpen, setIsPositionsOpen] = useState<boolean>(false);
  const { positions, claimableCount, activeCount } = usePositions(wallet.address);

  return (
    <div className="umayra-app-shell">
      <nav className="app-nav-bar" aria-label="App navigation">
        <div className="app-nav-left">
          <button
            className="app-nav-back"
            onClick={onBackToLanding}
            id="app-back-btn"
            aria-label="Back to landing page"
          >
            <ArrowLeft size={13} />
            <span>Back</span>
          </button>
          <UmayraLogo variant="full" size={26} />
        </div>

        <div className="app-nav-right">
          {/* My Predictions Pill Button */}
          {wallet.isConnected && (
            <button 
              className={`app-predictions-btn ${claimableCount > 0 ? 'has-claimable' : ''}`}
              onClick={() => setIsPositionsOpen(true)}
              id="my-predictions-btn"
              title="View my active and settled predictions"
            >
              <Coins size={12} />
              <span>Predictions ({positions.length})</span>
              {claimableCount > 0 ? (
                <span className="claimable-badge-dot" title={`${claimableCount} claimable winnings`}>
                  {claimableCount}
                </span>
              ) : activeCount > 0 ? (
                <span className="active-badge-dot" title={`${activeCount} active predictions`} />
              ) : null}
            </button>
          )}

          {/* Network indicator */}
          {wallet.isConnected && !wallet.isCorrectNetwork ? (
            <button 
              className="app-network-tag wrong-network"
              onClick={wallet.switchNetwork}
              title="Click to switch to Somnia Shannon testnet"
            >
              <AlertTriangle size={11} className="text-down" />
              <span>Switch to Shannon</span>
            </button>
          ) : (
            <div className="app-network-tag" aria-label="Network: Somnia Shannon testnet">
              <Globe2 size={11} aria-hidden="true" />
              Shannon · 50312
            </div>
          )}

          {/* Wallet address status or Read-Only tag */}
          {wallet.isConnected ? (
            <div className="app-wallet-tag" title={wallet.address || ''}>
              <Wallet size={11} aria-hidden="true" />
              <span className="font-mono">{wallet.shortAddress}</span>
              {wallet.nativeBalance && (
                <span className="app-wallet-balance font-mono">({wallet.nativeBalance})</span>
              )}
            </div>
          ) : (
            <div className="app-readonly-tag">
              <span
                className="live-dot"
                style={{ width: '5px', height: '5px' }}
                aria-hidden="true"
              />
              Read-Only
            </div>
          )}
        </div>
      </nav>

      <ConversationalInterface />

      {/* Positions / Post Trade Drawer */}
      <PositionsDrawer 
        isOpen={isPositionsOpen} 
        onClose={() => setIsPositionsOpen(false)} 
      />
    </div>
  );
};

export const App: React.FC = () => {
  const [page, setPage] = useState<AppPage>('landing');

  const enterApp = () => {
    setPage('app');
    window.scrollTo({ top: 0 });
  };

  const backToLanding = () => {
    setPage('landing');
    window.scrollTo({ top: 0 });
  };

  if (page === 'landing') {
    return <LandingPage onEnterApp={enterApp} />;
  }

  return (
    <WalletProvider>
      <AppShell onBackToLanding={backToLanding} />
    </WalletProvider>
  );
};

export default App;
