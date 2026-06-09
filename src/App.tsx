import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  ShieldCheck, 
  Vote as VoteIcon, 
  UserCircle, 
  ChevronRight, 
  Activity,
  History,
  Info,
  CheckCircle2,
  Lock,
  Cpu,
  BarChart3
} from 'lucide-react';
import { Election, Block, Candidate, VoterIdentity } from './types';
import { getElections, getBlockchain, submitVote, forceMine, getSocket, registerVoter } from './services/blockchainService';
import { generateVoterIdentity, generateAnonymousVote } from './services/cryptoService';
import { formatHash, formatDate, cn } from './lib/utils';

// --- Components ---

const StatusBadge = ({ label, active }: { label: string; active: boolean }) => (
  <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-orange-400/30 bg-slate-900/80 hover:bg-slate-800 transition-colors">
    <div className={cn("w-2 h-2 rounded-full animate-pulse", active ? "bg-orange-400 shadow-[0_0_12px_rgba(45,212,191,0.8)]" : "bg-slate-500")} />
    <span className="text-xs font-mono uppercase tracking-widest text-orange-400 font-semibold">{label}</span>   
  </div>
);

function CandidateCard(props: { candidate: Candidate; selected: boolean; onSelect: () => void; results: number }) {
  const { candidate, selected, onSelect, results } = props;
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        "w-full p-6 rounded-2xl border transition-all text-left group relative overflow-hidden human-touch",
        selected 
          ? "border-orange-400/50 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 ring-1 ring-orange-400/30 welcome-glow" 
          : "border-slate-700/50 bg-slate-900/70 hover:border-slate-600"
      )}
    >
      <div className="flex justify-between items-start relative z-10">
        <div className="space-y-1">
          <h4 className="font-medium text-lg text-slate-100">{candidate.name}</h4>
          <p className="text-sm text-slate-400 font-mono italic">{candidate.party}</p>
        </div>
        {results > 0 && (
          <div className="text-right ml-4">
            <span className="text-3xl font-mono font-semibold text-yellow-400">{results}</span>
            <p className="text-xs uppercase tracking-tighter text-slate-500">Votes</p>
          </div>
        )}
      </div>
      {selected && (
        <div className="absolute right-[-20px] bottom-[-20px] rotate-[-12deg] opacity-10">
          <ShieldCheck size={120} className="text-orange-400" />
        </div>
      )}
    </motion.button>
  );
}

function BlockchainNode(props: { block: Block; isNew: boolean }) {
  const { block, isNew } = props;
  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -20, scale: 0.95 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className="min-w-[340px] p-6 rounded-2xl bg-slate-900/80 border border-slate-700/50 relative group space-y-6 human-touch"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-orange-500/10">
            <Cpu size={18} className="text-orange-400" />
          </div>
          <span className="text-sm font-mono text-orange-400">Block #{block.index}</span>
        </div>
        <div className="px-4 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-400">
          NONCE: {block.nonce}
        </div>
      </div>
      
      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2 font-semibold">Hash</label>
          <div className="font-mono text-sm text-slate-300 bg-slate-950 p-3 rounded-lg break-all border border-slate-700">
            {block.hash}
          </div>
        </div>
        
        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400 block mb-2 font-semibold">Prev Hash</label>
          <div className="font-mono text-sm text-slate-500 bg-slate-950/50 p-3 rounded-lg break-all">
            {formatHash(block.previousHash)}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Transactions</span>
            <span className="text-yellow-400 font-mono font-semibold">{block.votes.length} Votes</span>
          </div>
        </div>
      </div>

      {block.index > 0 && (
        <div className="absolute left-[-16px] top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-orange-400/70 transition-colors">
          <ChevronRight size={18} />
        </div>
      )}
    </motion.div>
  );
}

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'landing' | 'vote' | 'admin'>('landing');
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [blockchain, setBlockchain] = useState<Block[]>([]);
  const [results, setResults] = useState<Record<string, Record<string, number>>>({});
  const [voterName, setVoterName] = useState('');
  const [identity, setIdentity] = useState<VoterIdentity | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    loadInitialData();

    const socket = getSocket();
    socket.on('results_update', ({ electionId, results }: { electionId: string; results: Record<string, number> }) => {
      setResults(prev => ({ ...prev, [electionId]: results }));
    });

    socket.on('new_vote', ({ nullifier, timestamp }: { nullifier: string; timestamp: number }) => {
      setLogs(prev => [`[${formatDate(timestamp)}] ZK Proof Validated. Nullifier: ${nullifier}`, ...prev.slice(0, 10)]);
    });

    socket.on('block_mined', (block: Block) => {
      setBlockchain(prev => [...prev, block]);
      setLogs(prev => [`[${formatDate(block.timestamp)}] Block #${block.index} successfully mined and linked.`, ...prev.slice(0, 10)]);
      loadInitialData();
    });

    return () => {
      socket.off('results_update');
      socket.off('new_vote');
      socket.off('block_mined');
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const activeElections = await getElections();
      setElections(activeElections);
      if (activeElections.length > 0) setSelectedElection(activeElections[0]);
      
      const chainData = await getBlockchain();
      setBlockchain(chainData.chain);

      const tallies: Record<string, Record<string, number>> = {};
      for (const e of activeElections) {
        tallies[e.id] = await (await fetch(`/api/results/${e.id}`)).json();
      }
      setResults(tallies);
    } catch (err) {
      console.error('Failed to load data', err);
    }
  };

  const handleRegister = async () => {
    if (!voterName) return;
    setIsRegistering(true);
    try {
      const idData = await generateVoterIdentity();
      await registerVoter(idData.commitment);
      setIdentity(idData);
      setLogs(prev => [`[${formatDate(Date.now())}] ZK Identity registered. Commitment: ${idData.commitment.substring(0, 16)}...`, ...prev]);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Registration failed.' });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVote = async () => {
    if (!selectedElection || !selectedCandidateId || !identity) return;
    setIsVoting(true);
    try {
      const timestamp = Date.now();
      const { nullifier, zkProof } = await generateAnonymousVote(identity.secret, selectedElection.id, selectedCandidateId);
      
      const result = await submitVote({
        nullifier,
        candidateId: selectedCandidateId,
        timestamp,
        zkProof,
        electionId: selectedElection.id,
        commitment: identity.commitment
      });

      if (result.success) {
        setFeedback({ type: 'success', message: 'Your anonymous vote has been accepted and added to the block.' });
      } else {
        setFeedback({ type: 'error', message: result.error || 'Voting failed.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Cryptographic proof generation failed.' });
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setView('landing')}>
            <div className="p-3.5 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl group-hover:rotate-12 transition-transform shadow-xl shadow-orange-500/30">
              <ShieldCheck className="text-white" size={28} />
            </div>
            <h1 className="font-bold text-3xl tracking-tighter bg-gradient-to-r from-orange-400 via-yellow-300 to-indigo-400 bg-clip-text text-transparent">
              Elexora 🗳️
            </h1>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <nav className="flex gap-8">
              <button 
                onClick={() => setView('vote')} 
                className={cn("px-5 py-2.5 text-base font-medium transition-all rounded-xl",
                  view === 'vote' 
                    ? "bg-orange-500/10 text-orange-400 border border-orange-500/30" 
                    : "hover:text-slate-100 hover:bg-slate-800"
                )}
              >
                Voter Portal 🗳️
              </button>
              <button 
                onClick={() => setView('admin')} 
                className={cn("px-5 py-2.5 text-base font-medium transition-all rounded-xl",
                  view === 'admin' 
                    ? "bg-orange-500/10 text-orange-400 border border-orange-500/30" 
                    : "hover:text-slate-100 hover:bg-slate-800"
                )}
              >
                Nodes & Audit ⚙️
              </button>
            </nav>
            <StatusBadge label="Network Active" active={true} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-12"
            >
              <div className="max-w-3xl mx-auto text-center">
                <p className="text-orange-400 font-mono text-sm uppercase tracking-[0.3em] mb-6">SECURE DECENTRALIZED GOVERNANCE</p>
                <h2 className="text-6xl md:text-7xl font-bold tracking-tighter leading-tight mb-8 bg-gradient-to-br from-orange-300 via-yellow-300 to-indigo-300 bg-clip-text text-transparent">
                  Immutable.<br />Transparent.<br />Verifiable.
                </h2>
                <div className="flex flex-wrap justify-center gap-6">
                  <button 
                    onClick={() => setView('vote')}
                    className="btn-gradient-lg flex items-center gap-3"
                  >
                    Cast Your Vote <ChevronRight size={20} />
                  </button>
                  <button 
                    onClick={() => setView('admin')}
                    className="btn-outline-lg"
                  >
                    View Blockchain 📊
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="card-glass-lg p-8">
                  <BarChart3 className="text-yellow-400 mb-6" size={42} />
                  <h3 className="text-2xl font-semibold mb-3">Live Tallying</h3>
                  <p className="text-slate-400">Real-time results verified across all nodes.</p>
                </div>
                <div className="card-glass-lg p-8">
                  <Lock className="text-orange-400 mb-6" size={42} />
                  <h3 className="text-2xl font-semibold mb-3">Zero-Knowledge</h3>
                  <p className="text-slate-400">Your vote remains completely anonymous.</p>
                </div>
                <div className="card-glass-lg p-8">
                  <Activity className="text-indigo-400 mb-6" size={42} />
                  <h3 className="text-2xl font-semibold mb-3">Tamper-Proof</h3>
                  <p className="text-slate-400">Every vote is cryptographically secured.</p>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'vote' && (
            <motion.div
              key="vote"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="p-4 bg-slate-800 rounded-2xl">
                  <VoteIcon className="text-yellow-400" size={32} />
                </div>
                <div>
                  <h2 className="text-4xl font-bold">Voter Portal</h2>
                  <p className="text-slate-400">Cast your secure anonymous vote</p>
                </div>
              </div>

              {!identity ? (
                <div className="card-glass-lg text-center max-w-lg mx-auto">
                  <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                    <UserCircle className="text-orange-400" size={48} />
                  </div>
                  <h3 className="text-3xl font-semibold mb-4">Zero-Knowledge Registration</h3>
                  <p className="text-slate-400 mb-8">Create your anonymous identity. Your real identity stays private.</p>
                  
                  <div className="space-y-4 max-w-sm mx-auto">
                    <input 
                      type="text" 
                      placeholder="Enter your full name" 
                      value={voterName}
                      onChange={(e) => setVoterName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-orange-500 text-slate-200 placeholder-slate-500"
                    />
                    <button 
                      onClick={handleRegister}
                      disabled={isRegistering || !voterName}
                      className="btn-gradient-lg w-full"
                    >
                      {isRegistering ? 'Generating ZK Identity...' : 'Create Anonymous Identity'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  {/* Identity Info */}
                  <div className="card-glass-lg flex items-center justify-between p-8">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-2xl font-bold">
                        {voterName[0]}
                      </div>
                      <div>
                        <p className="text-xl font-medium">{voterName}</p>
                        <p className="text-sm font-mono text-slate-400 break-all">
                          COMMITMENT: {identity.commitment.substring(0, 28)}...
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setIdentity(null)} className="text-slate-400 hover:text-red-400 text-sm underline">Clear Identity</button>
                  </div>

                  {/* Election & Candidates */}
                  <div>
                    <h3 className="text-2xl font-semibold mb-6">Active Election</h3>
                    {elections.map(e => (
                      <div key={e.id} className="space-y-6">
                        <h4 className="text-3xl font-bold text-orange-300">{e.name}</h4>
                        <div className="grid md:grid-cols-2 gap-6">
                          {e.candidates.map(candidate => (
                            <CandidateCard 
                              key={candidate.id} 
                              candidate={candidate} 
                              selected={selectedCandidateId === candidate.id}
                              onSelect={() => setSelectedCandidateId(candidate.id)}
                              results={results[e.id]?.[candidate.id] || 0}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {feedback && (
                    <div className={cn(
                      "p-5 rounded-2xl flex items-center gap-4 text-lg",
                      feedback.type === 'success' 
                        ? "bg-green-900/50 border border-green-500/50 text-green-300" 
                        : "bg-red-900/50 border border-red-500/50 text-red-300"
                    )}>
                      {feedback.type === 'success' ? <CheckCircle2 size={28} /> : <Info size={28} />}
                      {feedback.message}
                    </div>
                  )}

                  <button
                    onClick={handleVote}
                    disabled={isVoting || !selectedCandidateId}
                    className="w-full btn-gradient-lg py-7 text-xl shadow-2xl shadow-orange-500/30 disabled:opacity-70"
                  >
                    {isVoting ? 'Signing & Submitting Vote...' : 'Cast Secure Anonymous Vote 🗳️'}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-slate-800 rounded-2xl">
                    <Database className="text-yellow-400" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-bold">Blockchain Ledger</h2>
                    <p className="text-slate-400">Live network monitoring</p>
                  </div>
                </div>
                <button 
                  onClick={forceMine}
                  className="btn-outline-lg"
                >
                  Force Mine Block
                </button>
              </div>

              {/* Blockchain Visualization */}
              <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide">
                {blockchain.map((block, i) => (
                  <BlockchainNode 
                    key={block.hash} 
                    block={block} 
                    isNew={i === blockchain.length - 1} 
                  />
                ))}
                {blockchain.length === 0 && (
                  <div className="w-full py-24 text-center border border-dashed border-slate-700 rounded-3xl">
                    <p className="text-slate-400 text-xl">Waiting for first block...</p>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-10">
                {/* Logs */}
                <div className="card-glass-lg flex flex-col h-full">
                  <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      <History className="text-orange-400" size={24} />
                      <h3 className="font-semibold text-xl">System Logs</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-orange-400">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" /> LIVE
                    </div>
                  </div>
                  <div className="p-6 font-mono text-sm space-y-4 overflow-y-auto max-h-[420px]">
                    {logs.length > 0 ? logs.map((log, i) => (
                      <div key={i} className="text-slate-300 border-l-2 border-orange-500 pl-4">
                        {log}
                      </div>
                    )) : <p className="text-slate-500 italic text-center py-12">No activity yet</p>}
                  </div>
                </div>

                {/* Live Results */}
                <div className="card-glass-lg flex flex-col">
                  <div className="p-6 border-b border-slate-700 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      <Activity className="text-yellow-400" size={24} />
                      <h3 className="font-semibold text-xl">Live Results</h3>
                    </div>
                  </div>
                  <div className="p-6 space-y-8 overflow-y-auto max-h-[420px]">
                    {elections.map(e => (
                      <div key={e.id}>
                        <h4 className="font-mono uppercase text-xs tracking-widest text-slate-400 mb-4">{e.name}</h4>
                        {e.candidates.map(c => {
                          const res = results[e.id] || {};
                          const votes = res[c.id] || 0;
                          const total = Object.values(res).reduce((a: number, b: number) => a + b, 0) || 1;
                          const percent = Math.round((votes / total) * 100);
                          return (
                            <div key={c.id} className="mb-6 last:mb-0">
                              <div className="flex justify-between mb-2">
                                <span className="font-medium">{c.name}</span>
                                <span className="font-mono text-yellow-400">{votes} ({percent}%)</span>
                              </div>
                              <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percent}%` }}
                                  className="h-full bg-gradient-to-r from-orange-400 to-yellow-400"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-slate-800 py-8 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 text-sm font-mono">
          Elexora Protocol v1.5.0 — Secure • Decentralized • Verifiable
        </div>
      </footer>
    </div>
  );
}
