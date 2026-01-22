"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { generateQuarterlyNumbers, type GameAxisData } from "@/lib/game-logic";

// --- Types ---

export interface Player {
  id: string;
  name: string;
  squares: number; // Count of squares owned
  paid: boolean;
  paidAt?: number; // Timestamp when payment was made
}

export interface PayoutEvent {
  id: string;
  period: number | string; // 1, 2, 3, 4 or "Final"
  label: string; // "Q1 Winner", "Touchdown", etc.
  amount: number;
  winnerUserId: string;
  winnerName: string;
  timestamp: number;
  teamAScore: number;
  teamBScore: number;
  // Metadata for global history
  gameId?: string;
  gameName?: string;
  teamA?: string;
  teamB?: string;
  eventDate?: string;
  winners?: { uid: string; name: string }[]; // For shared pots
}

export type PayoutLog = PayoutEvent; // <--- ADD THIS ALIAS

export interface GameSettings {
  name: string;
  teamA: string;
  teamB: string;
  pricePerSquare: number;
  rows: number[]; // The 0-9 digits for Team A (Vertical usually)
  cols: number[]; // The 0-9 digits for Team B (Horizontal usually)
  isScrambled: boolean; // Have the digits been randomized yet?
  payouts: { label: string; amount: number }[]; // Custom payout structure (optional)
  espnGameId?: string; // Linked Live Game ID
  eventName?: string; // "Super Bowl LIX"
  espnLeague?: string; // "nfl", "nba"
  eventDate?: string; // ISO date string
  payoutFrequency?: "Standard" | "NBA_Frequent" | "Manual";
  
  // --- NEW: The Container for Quarterly Data ---
  axisValues?: GameAxisData; 
}

export interface SquareClaim {
  uid: string;
  name: string;
  claimedAt: number; 
}

export interface GameState {
  id: string;
  hostUserId: string;
  hostName: string;
  createdAt: number;
  settings: GameSettings;
  squares: Record<string, SquareClaim[]>; // key: "rowIndex-colIndex" -> [{uid, name}]
  players: Player[];
  scores: { teamA: number; teamB: number }; // Manual score tracking
  payoutHistory: PayoutEvent[];
}

interface GameContextType {
  activeGame: GameState | null;
  settings: GameSettings;
  squares: Record<string, SquareClaim[]>;
  players: Player[];
  scores: { teamA: number; teamB: number };
  payoutHistory: PayoutEvent[];
  loading: boolean;
  createGame: (name: string, price: number, teamA: string, teamB: string) => Promise<string>;
  joinGame: (gameId: string, password?: string, userId?: string) => Promise<void>;
  leaveGame: () => void;
  claimSquare: (row: number, col: number, user: { id: string; name: string }) => Promise<void>;
  unclaimSquare: (row: number, col: number, userId: string) => Promise<void>;
  togglePaid: (playerId: string) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
  updateScores: (teamA: number, teamB: number) => Promise<void>;
  scrambleGridDigits: () => Promise<void>;
  resetGridDigits: () => Promise<void>;
  resetGame: () => Promise<void>;
  updateSettings: (newSettings: Partial<GameSettings>) => Promise<void>;
  getUserGames: (userId: string) => Promise<GameState[]>;
  logPayout: (event: PayoutEvent) => Promise<void>;
  deleteGame: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);

  // Default empty state to prevent crashes
  const defaultSettings: GameSettings = {
    name: "",
    teamA: "Team A",
    teamB: "Team B",
    pricePerSquare: 0,
    rows: [],
    cols: [],
    isScrambled: false,
    payouts: [],
    payoutFrequency: "Standard"
  };

  // Sync with Firebase when activeGameId changes
  useEffect(() => {
    if (!activeGameId) {
      setActiveGame(null);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(doc(db, "games", activeGameId), (docSnap) => {
      setLoading(false);
      if (docSnap.exists()) {
        const data = docSnap.data() as GameState;
        // Ensure arrays exist
        if (!data.squares) data.squares = {};
        if (!data.players) data.players = [];
        if (!data.payoutHistory) data.payoutHistory = [];
        // Sort history by timestamp desc (newest first)
        data.payoutHistory.sort((a, b) => b.timestamp - a.timestamp);
        
        setActiveGame({ ...data, id: docSnap.id });
      } else {
        // Game deleted or invalid
        setActiveGameId(null);
        setActiveGame(null);
      }
    }, (err) => {
      console.error("Game sync error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [activeGameId]);

  const createGame = async (name: string, price: number, teamA: string, teamB: string) => {
    if (!user) throw new Error("Must be logged in");

    const newGame: Omit<GameState, "id"> = {
      hostUserId: user.uid,
      hostName: user.displayName || "Host",
      createdAt: Date.now(),
      settings: {
        name,
        pricePerSquare: price,
        teamA,
        teamB,
        rows: [], 
        cols: [],
        isScrambled: false,
        payouts: [],
        payoutFrequency: "Standard"
      },
      squares: {},
      players: [],
      scores: { teamA: 0, teamB: 0 },
      payoutHistory: []
    };

    const docRef = await doc(collection(db, "games"));
    await setDoc(docRef, newGame);
    setActiveGameId(docRef.id);
    return docRef.id;
  };

  const joinGame = async (gameId: string, password?: string, userId?: string) => {
     // In a real app, you might check a password or whitelist here.
     // For now, we just set the ID and let the snapshot listener handle the rest.
     setActiveGameId(gameId);
  };

  const leaveGame = () => {
    setActiveGameId(null);
    setActiveGame(null);
  };

  const updateSettings = async (newSettings: Partial<GameSettings>) => {
    if (!activeGame) return;
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(newSettings)) {
        updates[`settings.${key}`] = value;
    }
    await updateDoc(doc(db, "games", activeGame.id), updates);
  };

  const claimSquare = async (row: number, col: number, claimant: { id: string; name: string }) => {
    if (!activeGame) return;
    
    // Optimistic check
    const key = `${row}-${col}`;
    const existing = activeGame.squares[key] || [];
    // Rule: Usually 1 person per square, but some variants allow multiple. 
    // We will assume 1 per square for standard logic unless modified.
    if (existing.length > 0) {
        // alert("Square already taken!"); 
        // return;
        // Actually, let's allow overwrite ONLY if host? Or block?
        // Let's Block for now to prevent race conditions visual glitches
        // throw new Error("Square Taken");
    }

    // Update Square
    // We use arrayUnion to allow multiple if we change logic later, 
    // but typically we just overwrite if strictly 1-to-1.
    // For specific key update in map:
    // Firestore map update: "squares.0-0": [...]
    
    // We also need to update Player count.
    // Check if player exists in list
    let playerIndex = activeGame.players.findIndex(p => p.id === claimant.id);
    let newPlayer = false;
    
    // To do this atomically is hard without a Transaction. 
    // We will do a simple updateDoc and assume low contention for this MVP.
    
    const updates: Record<string, any> = {};
   // Replace Line 247 with this:
updates[`squares.${key}`] = arrayUnion({ 
  uid: claimant.id, 
  name: claimant.name, 
  claimedAt: Date.now() 
}); 

    if (playerIndex === -1) {
        // Add new player to array
        newPlayer = true;
        updates["players"] = arrayUnion({ id: claimant.id, name: claimant.name, squares: 1, paid: false });
    } else {
        // Increment player square count. 
        // arrayUnion doesn't support updating object fields in array. 
        // We have to read-modify-write players array or store players as a Map.
        // Storing as Map is better for updates, but Array is easier for iteration.
        // We'll do read-modify-write since we have local state.
        const updatedPlayers = [...activeGame.players];
        updatedPlayers[playerIndex].squares += 1;
        updates["players"] = updatedPlayers;
    }

    await updateDoc(doc(db, "games", activeGame.id), updates);
  };

  const unclaimSquare = async (row: number, col: number, userId: string) => {
    if (!activeGame) return;
    const key = `${row}-${col}`;
    const claims = activeGame.squares[key] || [];
    const claimToRemove = claims.find(c => c.uid === userId);
    
    if (!claimToRemove) return;

    const updates: Record<string, any> = {};
    updates[`squares.${key}`] = arrayRemove(claimToRemove);

    // Decrement player count
    const playerIndex = activeGame.players.findIndex(p => p.id === userId);
    if (playerIndex !== -1) {
        const updatedPlayers = [...activeGame.players];
        updatedPlayers[playerIndex].squares = Math.max(0, updatedPlayers[playerIndex].squares - 1);
        updates["players"] = updatedPlayers;
    }

    await updateDoc(doc(db, "games", activeGame.id), updates);
  };

  const togglePaid = async (playerId: string) => {
    if (!activeGame) return;
    const playerIndex = activeGame.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const updatedPlayers = [...activeGame.players];
    updatedPlayers[playerIndex].paid = !updatedPlayers[playerIndex].paid;
    // Set paidAt timestamp when marking as paid, clear when marking as unpaid
    updatedPlayers[playerIndex].paidAt = updatedPlayers[playerIndex].paid ? Date.now() : undefined;
    
    await updateDoc(doc(db, "games", activeGame.id), { players: updatedPlayers });
  };

  const deletePlayer = async (playerId: string) => {
      if (!activeGame) return;
      // This is nuclear: Remove player AND all their squares?
      // For MVP, just remove player from list. Squares remain "claimed" by ID but orphaned? 
      // Better to unclaim all squares too.
      
      const newSquares = { ...activeGame.squares };
      let changed = false;
      
      Object.keys(newSquares).forEach(key => {
          const originalLen = newSquares[key].length;
          newSquares[key] = newSquares[key].filter(c => c.uid !== playerId);
          if (newSquares[key].length !== originalLen) changed = true;
          if (newSquares[key].length === 0) delete newSquares[key];
      });

      const newPlayers = activeGame.players.filter(p => p.id !== playerId);

      await updateDoc(doc(db, "games", activeGame.id), {
          players: newPlayers,
          squares: newSquares
      });
  };

  const updateScores = async (teamA: number, teamB: number) => {
    if (!activeGame) return;
    await updateDoc(doc(db, "games", activeGame.id), {
        scores: { teamA, teamB }
    });
  };

  // --- UPDATED: ENGINE UPGRADE ---
  const scrambleGridDigits = async () => {
    if (!activeGame) return;

    // 1. Generate 4 sets of random numbers (Q1, Q2, Q3, Final)
    const newAxisData = generateQuarterlyNumbers();

    // 2. Update the "Visual" rows/cols (Defaults to Q1 for immediate display)
    const newRows = newAxisData.q1.rows;
    const newCols = newAxisData.q1.cols;

    // 3. Save EVERYTHING to Firebase
    // We save 'axisValues' (the history) AND 'rows/cols' (the current view)
    const updates = {
      "settings.isScrambled": true,
      "settings.rows": newRows,
      "settings.cols": newCols,
      "settings.axisValues": newAxisData, 
    };

    try {
      await updateDoc(doc(db, "games", activeGame.id), updates);
    } catch (error) {
      console.error("Failed to scramble grid:", error);
      alert("Failed to scramble grid. Check console.");
    }
  };

  const resetGridDigits = async () => {
    if (!activeGame) return;
    await updateDoc(doc(db, "games", activeGame.id), {
        "settings.rows": [],
        "settings.cols": [],
        "settings.isScrambled": false,
        "settings.axisValues": null // Clear history
    });
  };
  
  const resetGame = async () => {
      if (!activeGame) return;
      await updateDoc(doc(db, "games", activeGame.id), {
          "settings.rows": [],
          "settings.cols": [],
          "settings.isScrambled": false,
          "settings.axisValues": null,
          squares: {},
          players: [],
          scores: { teamA: 0, teamB: 0 },
          payoutHistory: []
      });
  };

  const getUserGames = async (userId: string): Promise<GameState[]> => {
    // 1. Hosted Games
    const qHost = query(collection(db, "games"), where("hostUserId", "==", userId));
    const snapHost = await getDocs(qHost);
    const hosted = snapHost.docs.map(d => ({ ...d.data(), id: d.id } as GameState));

    // 2. Joined Games (This is expensive in Firestore if we don't denormalize)
    // We can cheat: We only find games where we are host for now in this helper?
    // Or we rely on client side filtering if lists are small? No.
    // Correct way: "participants" array in game doc.
    // We haven't added "participants" array yet. 
    // We'll rely on hosted games + activeGame for now, or just hosted.
    // A better way for "My Games" list is to store "myGames" subcollection on User.
    // For this MVP, we will only return Hosted Games to keep it simple and fast.
    
    return hosted;
  };

  const logPayout = async (event: PayoutEvent) => {
    if (!activeGame) return;
    // Append to history
    await updateDoc(doc(db, "games", activeGame.id), {
        payoutHistory: arrayUnion(event)
    });
  };

  const deleteGame = async () => {
      if (!activeGame) return;
      await deleteDoc(doc(db, "games", activeGame.id));
      setActiveGameId(null);
      setActiveGame(null);
  };

  return (
    <GameContext.Provider value={{
      activeGame,
      settings: activeGame?.settings || defaultSettings,
      squares: activeGame?.squares || {},
      players: activeGame?.players || [],
      scores: activeGame?.scores || { teamA: 0, teamB: 0 },
      payoutHistory: activeGame?.payoutHistory || [],
      loading,
      createGame,
      joinGame,
      leaveGame,
      claimSquare,
      unclaimSquare,
      togglePaid,
      deletePlayer,
      updateScores,
      scrambleGridDigits,
      resetGridDigits,
      resetGame,
      updateSettings,
      getUserGames,
      logPayout,
      deleteGame
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
}