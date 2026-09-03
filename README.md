Umayra

Conversational AI for Event Contract Trading on Somnia

Umayra is an AI-powered conversational interface for discovering, understanding, and trading DreamDEX Event Contracts on the Somnia Shannon testnet.

Instead of navigating complex trading interfaces, users can interact with Umayra naturally through text or voice, describe what they want to trade, review the proposed trade, and confirm the transaction before it is executed onchain.



What is Umayra?

Event contract trading can require users to understand markets, contract outcomes, trading interfaces, and blockchain transactions.

Umayra simplifies this experience by putting a conversational AI layer between the user and the DreamDEX trading infrastructure.

A user can say things like:

“Show me the live BTC markets.”

“I think BTC will go up.”

“Find me an ETH market that is currently open.”

“Take the trade with $10.”

Umayra interprets the user’s intent, discovers relevant live markets, matches the request to an appropriate event contract, presents a trade review, and executes the order after user confirmation.



Core Experience

User
  ↓
Voice or Text Input
  ↓
Intent Parser
  ↓
Live Market Discovery
  ↓
Market Matching
  ↓
Trade Review
  ↓
User Confirmation
  ↓
Order Execution
  ↓
Somnia + DreamDEX

The goal is to make blockchain event contract trading feel more like having a conversation with a knowledgeable trading assistant.



Key Features

Conversational Trading

Users can describe their trading intent using natural language rather than navigating multiple screens.

Umayra interprets requests such as:

* “I think BTC will go up.”
* “Find an ETH market.”
* “Show me markets that are still open.”
* “Take this trade with $10.”

Voice Interaction

Umayra supports voice-based interaction through browser speech capabilities.

When the user speaks, Umayra can process the spoken intent and respond through the conversational interface.

Typed interactions remain text-based, while voice interactions can receive spoken responses.

 Live DreamDEX Market Discovery

Umayra connects to the DreamDEX market infrastructure to discover available Event Contract markets.

The system can identify relevant markets, including BTC and ETH contracts, and distinguish between markets that are currently tradable and markets that are no longer accepting orders.

Intelligent Market Matching

The user’s natural language intent is translated into a structured trading request and matched against available markets.

This allows a request such as:

“I think BTC will go up”

to be connected to an appropriate BTC Up Event Contract rather than requiring the user to manually search through markets.

 Trade Review

Before an order is submitted, Umayra presents the proposed trade for user review.

This creates an important confirmation step between conversational intent and blockchain execution.

Onchain Order Execution

Once the user confirms the trade, Umayra executes the order through the DreamDEX trading infrastructure on Somnia.

The transaction lifecycle can then be tracked and verified onchain.

Testnet First

Umayra was built and tested on the Somnia Shannon testnet, allowing the complete trading flow to be validated without using real funds.



Architecture

Umayra is organized around several focused services that work together to turn natural language into an onchain trade.

Intent Parser Service

Converts conversational input into structured trading intent.

For example:

"I think BTC will go up"
        ↓
Asset: BTC
Direction: UP
Action: TRADE

Market Discovery Service

Discovers available DreamDEX Event Contract markets and retrieves relevant market information.

Market Match Service

Matches the user’s intent against currently available markets.

The service helps ensure that the selected market corresponds to the requested asset, direction, and trading state.

Trade Review Service

Builds the proposed trade from the user’s intent and the matched market.

This information is presented to the user before execution.

Order Execution Service  Handles the final transaction flow after confirmation and submits the order through DreamDEX on Somnia.

Trade Review Card

Provides a clear confirmation layer between conversational intent and blockchain execution.

The user can review the proposed trade before deciding whether to proceed.



Blockchain & Protocol

Somnia

Umayra is built for the Somnia Shannon testnet, using Somnia’s high-performance blockchain infrastructure.

DreamDEX

Umayra uses DreamDEX Event Contracts as its underlying prediction-style trading infrastructure.

DreamDEX provides rolling event markets around assets such as BTC and ETH.

Testnet Assets

Development and testing use Somnia testnet assets, including:

* STT for gas
* TestUSDC for trading collateral

No real funds are required for the testnet experience.



Tech Stack

Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

Web3

* Somnia Shannon Testnet
* DreamDEX
* @somnia-chain/markets-sdk
* Wallet integration

AI / Interaction

* Conversational intent parsing
* Natural language market matching
* Browser voice recognition
* Voice response capabilities

Development

* Node.js
* Git
* GitHub



End-to-End Testnet Verification

The core trading flow has been tested end to end on the Somnia testnet.

The verified flow includes:

1. Connecting a wallet
2. Funding the wallet with Somnia testnet STT
3. Obtaining TestUSDC
4. Discovering live DreamDEX Event Contract markets
5. Identifying a relevant BTC or ETH market
6. Interpreting the user’s trading intent
7. Matching the intent to a live market
8. Presenting a trade review
9. Confirming the trade
10. Executing the order
11. Verifying the resulting position onchain

This validates the complete path from natural language intent to an executed blockchain transaction.



Why Umayra?

Traditional Web3 trading interfaces often require users to understand:

* Market terminology
* Contract mechanics
* Wallet interactions
* Trading interfaces
* Transaction confirmations
* Blockchain-specific workflows

Umayra explores a different interaction model:

What if users could simply tell an AI what they want to trade?

The interface becomes conversational while the underlying system still performs structured market discovery, validation, review, and blockchain execution.



Future Direction

Umayra can evolve beyond a simple conversational trading interface into a broader AI-native interface for event markets.

Potential future improvements include:

* More advanced market reasoning
* Portfolio and position awareness
* Risk explanations before trading
* Real-time market monitoring
* Better voice interaction
* Multi-market strategies
* Personalized trading preferences
* Market alerts and notifications
* Deeper DreamDEX integrations
* More sophisticated AI trading workflows



Hackathon

Built for the Somnia × DreamDEX Event Contracts Hackathon.

The project explores how conversational AI can make Event Contract markets more accessible while demonstrating real blockchain interaction on Somnia.

Status

MVP Functional

The current MVP demonstrates:

* Conversational interaction
* Voice interaction
* Live market discovery
* Intent parsing
* Market matching
* Trade review
* User confirmation
* Onchain order execution
* Testnet verification

⸻

Disclaimer

Umayra is a hackathon project and is currently designed for testnet experimentation.

It is not financial advice, and users should not interpret the project’s trading functionality as a recommendation to buy, sell, or trade any asset.

⸻

Built with

AI × Web3 × Somnia × DreamDEX

Umayra explores a future where interacting with blockchain markets can be as simple as having a conversation.
