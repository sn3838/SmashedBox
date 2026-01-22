"use client";

import React, { useState } from "react";
import { useGame } from "@/context/GameContext";
import { Loader2, Trophy, DollarSign, Users, Target } from "lucide-react";

interface Props {
  onSuccess: () => void;
}

export default function CreateGameForm({ onSuccess }: Props) {
  const { createGame } = useGame();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    price: 10,
    teamA: "Chiefs",
    teamB: "Eagles"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // The Fix: We now pass 4 separate arguments instead of 1 big object
      await createGame(
        formData.name, 
        Number(formData.price), 
        formData.teamA, 
        formData.teamB
      );
      onSuccess();
    } catch (err) {
      console.error("Creation failed", err);
      alert("Failed to create game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-white/10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
          <Trophy className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Host a Game</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Set the stakes and invite your crew.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Game Name */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Game Name</label>
          <div className="relative">
            <Target className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
            <input 
              required
              type="text"
              placeholder="e.g. Mike's Super Bowl Bash"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Teams Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team A (Vertical)</label>
            <input 
              required
              type="text"
              value={formData.teamA}
              onChange={e => setFormData({...formData, teamA: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team B (Horizontal)</label>
            <input 
              required
              type="text"
              value={formData.teamB}
              onChange={e => setFormData({...formData, teamB: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Price Per Square</label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-green-600" />
            <input 
              required
              type="number"
              min="0"
              value={formData.price}
              onChange={e => setFormData({...formData, price: Number(e.target.value)})}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl font-black text-lg text-green-600 outline-none focus:ring-2 focus:ring-green-500 transition-all"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/30 transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : "CREATE GAME BOARD"}
        </button>
      </form>
    </div>
  );
}