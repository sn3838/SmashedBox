"use client";

import React, { useState } from "react";
import { useGame } from "@/context/GameContext";
import { Loader2, ArrowRight, Hash } from "lucide-react";

interface Props {
  onSuccess: () => void;
  initialGameId?: string;
}

export default function JoinGameForm({ onSuccess, initialGameId = "" }: Props) {
  const { joinGame } = useGame();
  const [gameId, setGameId] = useState(initialGameId);
  const [password, setPassword] = useState(""); // Kept for UI compatibility, even if unused
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsJoining(true);

    try {
      // The Fix: We await the function. If it fails, it throws an error (caught below).
      // If it succeeds, it returns nothing, so we just proceed.
      await joinGame(gameId, password);
      onSuccess();
    } catch (err: any) {
      console.error("Join failed", err);
      // Fallback error message if the error doesn't have a message
      setError(err.message || "Failed to join game. Check the code and try again.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-white/10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
          <ArrowRight className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Join the Action</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Enter the game code to get started.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Game Code</label>
          <div className="relative">
            <Hash className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
            <input 
              required
              type="text"
              placeholder="e.g. 8x92m..."
              value={gameId}
              onChange={e => setGameId(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all uppercase"
            />
          </div>
        </div>

        {/* Password field - Optional in UI, but kept for future-proofing 
           or if your backend requires it later.
        */}
        {/* <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password (Optional)</label>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
            <input 
              type="password"
              placeholder="••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div> 
        */}

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm font-bold rounded-xl text-center">
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isJoining || !gameId}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-500/30 transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isJoining ? <Loader2 className="animate-spin" /> : "ENTER GAME"}
        </button>
      </form>
    </div>
  );
}