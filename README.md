# Elexora 🗳️

**A Secure, Transparent, and Anonymous Decentralized Voting System** built with **Blockchain** and **Zero-Knowledge Proofs**.

## 🌟 Features

- **Anonymous Voting** using Zero-Knowledge Proofs (ZK)
- **Immutable & Transparent** blockchain ledger
- **Real-time Results** with live updates
- **Voter Identity Protection** via cryptographic commitments
- **Tamper-Proof** election system
- **Fully Auditable** public ledger
- Modern, responsive React + TypeScript UI

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Blockchain**: Custom Proof-of-Work Blockchain
- **Cryptography**: Zero-Knowledge Proofs, Pedersen Commitments, Nullifiers
- **Real-time**: Socket.io
- **Styling**: Modern glassmorphism + dark theme

## 🚀 How It Works

1. **Voter Registration** → Creates a Zero-Knowledge identity commitment
2. **Vote Casting** → Generates ZK proof proving vote is valid without revealing identity
3. **Vote Submission** → Added to blockchain via consensus
4. **Verification** → Anyone can verify the entire election on the public ledger

## 🧪 How to Run Locally

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/rewati1616/Elexora---Voting-System.git
cd Elexora---Voting-System

# Install dependencies
npm install

# Start the development server
npm run dev
```

## 🏗️ Project Structure

src/
├── components/          # Reusable UI components
├── services/            # Blockchain & crypto services
├── lib/                 # Utilities
├── types.ts             # TypeScript interfaces
└── main.tsx

## 🔐 Zero-Knowledge Implementation

- **Commitment Scheme**: Used for secure voter registration without revealing identity
- **Nullifier**: Prevents double voting while maintaining anonymity
- **ZK-SNARK Style Proofs**: Generates cryptographic proofs for anonymous vote validation

## 🎯 Future Enhancements

- Smart contract integration (Ethereum / Solana)
- Mobile application support
- Multi-election management system
- Advanced zk-SNARK circuits using **Circom**
- Aadhaar-based voter registration (India-specific)

## 🤝 Contributing

Contributions are welcome! Feel free to open issues and submit pull requests.

##
Made by Rewati for Digital Democracy
Elexora — Bringing trust back to voting.
