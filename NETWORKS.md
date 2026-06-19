From: https://ergoforum.org/t/sigmaverse-update/5222

===

The Problem

On-application KyAs, while a step in the right direction, present certain issues:

    Potential Bias: They are presented by the application’s own developer, who may not be incentivized to display all of the application’s assumptions with full transparency and associated risks.

    Cognitive Overload: Exhaustively detailing all assumptions requires presenting too much information to the user. This creates a counterproductive effect known as information overload or cognitive fatigue, as a wall of text discourages reading and, therefore, genuine understanding of the risks.

Proposed Solution

A simple option that can solve this problem in the short term is to “dust off” Sigmaverse, a somewhat outdated website that lists the ecosystem’s applications and tools. Sigmaverse is a project maintained and hosted, as I understand it, by the Ergo Foundation or by Sigmanauts—institutions reputable enough to carry out its mission fairly (a completely trustless solution would be excessively complex to implement in the short term).

My proposal is to update Sigmaverse to allow for the following:

    To solve developer bias (Problem 1):

        Become a community-managed source of truth: Sigmaverse should contain the trust assumptions for each application, allowing anyone—not just the project’s developers—to open a Pull Request (PR) on its repository to propose updates.

        Foster peer review: Invite all users and developers in the ecosystem to contribute to these KyAs. This creates a system where the community can verify that the assumptions are correct and complete. It allows other developers to investigate third-party solutions, judge their assumptions, and, if necessary, initiate a technical discussion through the Github PR itself to reach a consensus.

    To solve information overload (Problem 2):
        Create the “Sigmaverse Quality Standard”: Based on other quality standards, we can agree on certain key characteristics associated with visual icons. These labels would be displayed prominently, facilitating a quick understanding of the most important assumptions.

Sigmaverse Quality Standard - Specification (DRAFT)
Core Principle: Action-Centric Analysis

The standard operates under the Principle of Action-Centric Analysis. A system is broken down into its fundamental actions (e.g., “create proposal,” “claim funds”). Each action is analyzed across two dimensions: the Trust Category of the process that authorizes it and the Access Category required to execute it, each with a numerical level.
Trust Categories

Ranked numerically, where a lower level indicates greater decentralization and less reliance on external actors.

    Level 1: Direct Contract Validation (Trust-Minimized)
    The action’s validity is exclusively determined by the immutable rules encoded in the smart contract script. Permission is entirely contained within the verifiable logic of the contract itself. Any actor who can construct a transaction that satisfies these rules can execute the action, without needing the intervention or permission of an external mediator.

    Level 2: Action Mediated by a Crypto-economic Actor (Crypto-economic Security)
    The execution or validity of the action depends on the intervention of an external actor from a dynamic and permissionless set (e.g., oracles, keepers, validators). Confidence that these actors will behave honestly is based on explicit economic incentives, such as rewards for correct behavior or penalties (slashing) for malicious behavior.

    Level 3: Action Mediated by a Fiduciary Actor (Requires Fiduciary Trust)
    The execution or validity of the action depends on the intervention of an external actor from a static and permissioned set (e.g., the developer’s address, a multisig council, a governance committee). Trust is placed in the reputation, identity, or integrity of this specific group, as there are no direct crypto-economic mechanisms to guarantee their behavior.

Access Categories

Ranked numerically, where a lower level indicates greater user sovereignty.

    Level 1: Verifiable Artifact
    The action is executed via a software artifact (e.g., a desktop app, a command-line interface, a client-side web app) that the user downloads and runs in their own environment. The user has full control and does not depend on a third-party service to interact with the blockchain.

    Level 2: Centralized Service Dependency
    The action’s execution depends on a service hosted and operated by a third party (e.g., a project’s website, a centralized API). The availability and integrity of this service are necessary for the user to interact with the protocol.

Final Scores

For a quick summary, two final scores are calculated from the detailed analysis matrix of the application.

    Weakest Link Score: This score reflects the single greatest risk in the system, determined by the highest numerical level found in either the Trust or Access categories across the entire system.

    Average Risk Score: This score offers a holistic view of the system’s overall design, calculated as the average of all numerical levels assigned to all critical actions.

This standard allows the average user to quickly identify an application’s key properties through scores and icons and, if interested, delve deeper by reading the detailed assumptions in a structured matrix.

It is important to emphasize that the information on Sigmaverse should be exclusively formal and technical, keeping any commercial or advertising commentary separate. The best way to proceed would be to establish very specific guidelines on what a KyA should and should not contain.
Proposed Structure for Sigmaverse Guides

To implement this proposal in an orderly and standardized manner, I would like to suggest a basic structure for each application’s guide on Sigmaverse. We can consider each application as a “brand” (name, logo, etc.) that encompasses a set of technical components.

For each application, the following should be documented:

    Category and Subcategories: This allows for grouping applications with similar missions (e.g., “DeFi > DEX,” “Crowdfunding,” “Tools”) to facilitate search and comparison.

    General Information: This would include the brand (name, logo), a clear description of its purpose, a basic user guide, and official access points (links to the website, GitHub, social media).

    Features: A list of the functionalities and services the application offers the user. This section focuses on “what it does.”

    Trust Assumptions: A transparent breakdown of the trust vectors and potential points of failure, aligned with the Sigmaverse Quality Standard. This is where questions are answered, such as: Who or what must the user trust? Which parts are centralized? What could go wrong? This analysis will culminate in the calculation of the application’s final scores: the Weakest Link Score (highlighting the biggest risk) and the Average Risk Score (reflecting the overall system design).

Following this structure, our previous example would be perfectly framed. Both MewFund and Bene would be in the same “Crowdfunding” category. Each would have its general information, and when it comes to comparison, a user could see clearly—almost like in a product comparison table—that MewFund excels in the “Features” section with its wide range of options, while Bene excels in the “Trust Assumptions” section due to its high scores under the Sigmaverse Quality Standard.
Final Words

To be clear, this is not a criticism of the ecosystem or the Mew team. I believe their contribution has been and will continue to be very positive. However, failing to maintain clear and accessible trust assumptions greatly disincentivizes developers who are striving to build truly decentralized solutions.

People reason with ideas, and many users come and will come to Ergo precisely because of the trust assumptions it offers: a P2P system, more secure thanks to its smart contracts, and a model that encourages stateless applications.

Users must be clear about these same assumptions within the ecosystem. Otherwise, the exploitation of one of these centralized trust vectors (for example, a security failure or abuse by an intermediary) would not only harm the affected users but would damage the reputation and brand of the entire Ergo ecosystem.



===


Example with Bene: Proof-of-Funding Platform
Category and Subcategories

    Primary Category: Crowdfunding
    Subcategories: Decentralized Finance (DeFi)

General Information

Bene is a decentralized application (DApp) on the Ergo blockchain that allows projects to create trust-minimized fundraising campaigns. It enables creators to raise funds (in ERG) by offering project tokens in return. The entire process, from contribution to fund withdrawal or refund, is governed by on-chain smart contracts, eliminating the need for trusted intermediaries.

    Website: https://bene.stability.nexus
    GitHub: GitHub - StabilityNexus/BenefactionPlatform-Ergo: Fundraising Platform based on the Bene Proof-of-Funding Protocol

Features

    Campaign Creation: Project owners can define fundraising goals, deadlines, and token exchange rates.
    Decentralized Contributions: Anyone can contribute ERG to a campaign and receive a temporary Auxiliary Project Token (APT).
    Automated Refunds: If a campaign fails to meet its minimum funding goal by the deadline, contributors can automatically claim a full refund by exchanging their APTs back for ERG.
    Secure Fund Withdrawal: Project owners can only withdraw the collected ERGs after the funding goal has been successfully met.
    Token Management: Owners can add more tokens to a campaign or withdraw any unsold tokens.
    Final Token Exchange: Once a campaign is successful, contributors can exchange their temporary APTs for the final Proof-funding Tokens (PFTs).

Trust Assumptions (Sigmaverse Quality Standard Analysis)

This analysis breaks down Bene’s core actions to evaluate its trust and access requirements.
Action-Centric Analysis Matrix

Based on the protocol’s description, all critical user and owner actions are governed by immutable on-chain logic. Users interact directly with the smart contract without depending on a centralized service for transaction execution.
Critical Action 	Trust Category 	Access Category 	Justification
Token Acquisition 	Level 1 (Trust-Minimized) 	Level 1 (Verifiable Artifact) 	The exchange rate and logic are enforced by the smart contract. The user can create the transaction client-side.
Refund Tokens 	Level 1 (Trust-Minimized) 	Level 1 (Verifiable Artifact) 	Refund conditions are checked exclusively by the on-chain script.
Withdraw ERGs 	Level 1 (Trust-Minimized) 	Level 1 (Verifiable Artifact) 	Withdrawal is only possible if the funding goal is met, a rule enforced by the contract. The owner initiates this.
Exchange (APT → PFT) 	Level 1 (Trust-Minimized) 	Level 1 (Verifiable Artifact) 	The exchange is permitted by the contract only after the campaign’s success is confirmed on-chain.
Final Scores

    Weakest Link Score: 1
        This score reflects the highest risk level found in the system. A score of 1 indicates that no single action depends on a trusted third party or centralized service.
    Average Risk Score: 1.0
        This score provides a holistic view of the protocol’s design. An average of 1.0 signifies an exceptionally robust and decentralized architecture across all its functions.

Detailed Assumptions and Risks (KyA)

The scores confirm that Bene operates as a fully trust-minimized protocol at the technical level. However, using the application involves several layers of assumptions and risks that users must understand, extracted directly from the platform’s “Know Your Assumptions” (KyA).

1. Protocol-Level Assumptions (On-Chain Logic)

    Smart Contract Risk: You are trusting that the smart contract code, while public and auditable, is free of bugs or vulnerabilities. There is no guarantee against errors.
    Immutable Rules: The campaign conditions are enforced by the code and cannot be altered once launched:
        Refunds: A refund is only possible if both conditions are met: the deadline has passed and the minimum funding goal has not been reached.
        Withdrawals: Project owners can only withdraw funds if the minimum funding goal has been reached.
    Developer Fee: A 5% developer fee is automatically applied to all successfully funded projects. This fee is sent to a designated address when the project owner withdraws the funds.

2. Project-Level Assumptions (Human Trust)

    No Guarantee of Fulfillment: The most significant off-chain risk is trusting the project creator. Even if a project is successfully funded, the Bene protocol provides no guarantee that the project owners will deliver on their promises or use the funds as described. Bene is a neutral tool, not an escrow service that vets or endorses projects.

3. User-Level Responsibilities & Blockchain Realities

    Self-Custody: You are solely responsible for managing your own wallet, passwords, and private keys. No assistance can be provided if you lose access to your funds.
    Irreversibility: All transactions on the Ergo blockchain are final and irreversible once confirmed.
    Privacy: While the website does not collect personal data, all your transactions are publicly viewable on the blockchain explorer.
    Use At Your Own Risk: By using the platform, you acknowledge and agree that you are using it at your own risk and are solely responsible for your assets.
