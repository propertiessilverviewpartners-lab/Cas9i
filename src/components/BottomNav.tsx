import React from 'react';
import { Dice5, Ticket, Receipt, User } from 'lucide-react';
import { soundManager } from '../services/soundEffects';

export type MainTab = 'sports' | 'casino' | 'profile' | 'admin';

interface BottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  betslipCount: number;
  onOpenBetslip: () => void;
  onOpenCheckBets: () => void;
  onOpenAccount: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  betslipCount,
  onOpenBetslip,
  onOpenCheckBets
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-[#03140a]/95 backdrop-blur-md border-t border-[#00e700]/20 pb-safe">
      <div className="max-w-7xl mx-auto grid grid-cols-5 items-center h-16 px-1">
        {/* 1. Sports Tab */}
        <button
          onClick={() => {
            soundManager.playClick();
            onSelectTab('sports');
          }}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeTab === 'sports' ? 'text-[#00e700]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span className="text-xl">⚽</span>
          <span className="text-[10px] font-bold tracking-tight mt-0.5 whitespace-nowrap">Sports</span>
          {activeTab === 'sports' && (
            <div className="w-4 h-0.5 bg-[#00e700] rounded-full mt-0.5 shadow-[0_0_6px_#00e700]" />
          )}
        </button>

        {/* 2. Casino Tab */}
        <button
          onClick={() => {
            soundManager.playClick();
            onSelectTab('casino');
          }}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeTab === 'casino' ? 'text-[#00e700]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Dice5 className={`w-5 h-5 ${activeTab === 'casino' ? 'text-[#00e700]' : 'text-zinc-400'}`} />
          <span className="text-[10px] font-bold tracking-tight mt-0.5 whitespace-nowrap">Casino</span>
          {activeTab === 'casino' && (
            <div className="w-4 h-0.5 bg-[#00e700] rounded-full mt-0.5 shadow-[0_0_6px_#00e700]" />
          )}
        </button>

        {/* 3. Betslip Drawer Trigger (Center with Badge) */}
        <button
          onClick={() => {
            soundManager.playClick();
            onOpenBetslip();
          }}
          className="relative flex flex-col items-center justify-center h-full group"
        >
          <div className="relative">
            <Ticket className="w-5 h-5 text-zinc-300 group-hover:text-[#00e700] transition-colors" />
            <div className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#00ad3a] text-black font-black text-[10px] flex items-center justify-center shadow-[0_0_8px_#00e700]">
              {betslipCount}
            </div>
          </div>
          <span className="text-[10px] font-bold tracking-tight text-zinc-300 group-hover:text-[#00e700] mt-0.5 whitespace-nowrap">
            Betslip
          </span>
        </button>

        {/* 4. Check Bets (Receipts & Cash Out) */}
        <button
          onClick={() => {
            soundManager.playClick();
            onOpenCheckBets();
          }}
          className="flex flex-col items-center justify-center h-full text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight mt-0.5 whitespace-nowrap">Check Bets</span>
        </button>

        {/* 5. Individual User Profile Tab */}
        <button
          onClick={() => {
            soundManager.playClick();
            onSelectTab('profile');
          }}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            activeTab === 'profile' ? 'text-[#00e700]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-[#00e700]' : 'text-zinc-400'}`} />
          <span className="text-[10px] font-bold tracking-tight mt-0.5 whitespace-nowrap">Profile</span>
          {activeTab === 'profile' && (
            <div className="w-4 h-0.5 bg-[#00e700] rounded-full mt-0.5 shadow-[0_0_6px_#00e700]" />
          )}
        </button>
      </div>
    </div>
  );
};
