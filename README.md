# Anonymous Cash

Anonymous Cash is a non-custodial Ethereum and ERC20 privacy solution based on zkSNARKs. It improves transaction privacy by breaking the on-chain link between the recipient and destination addresses. It uses a smart contract that accepts ETH deposits that can be withdrawn by a different address. Whenever ETH is withdrawn by the new address, there is no way to link the withdrawal to the deposit, ensuring complete privacy.

To make a deposit user generates a secret and sends its hash (called a commitment) along with the deposit amount to the Anonymous smart contract. The contract accepts the deposit and adds the commitment to its list of deposits.

Later, the user decides to make a withdrawal. To do that, the user should provide a proof that he or she possesses a secret to an unspent commitment from the smart contract’s list of deposits. zkSnark technology allows that to happen without revealing which exact deposit corresponds to this secret. The smart contract will check the proof and transfer deposited funds to the address specified for withdrawal. An external observer will be unable to determine which deposit this withdrawal came from.

## Quick Start

### Set `.env`

```
cp .env.example .env
```

Change the PRIVATE_KEY to yours, fund the associated address with Testnet BNB at
<https://testnet.binance.org/faucet-smart>.

### Install Dependencies

```
yarn install
yarn assets
```

### Deploy Contracts

There is already a deployed contract in the `.env.example`, run this only if you want to deploy a new contract yourself.

```
yarn build:contract
yarn migrate:bsc_testnet
```

Change the `CONTRACT_ADDRESS` in `.env` to the address of the deployed contract `ETHAnonymous`,
and the `CONTRACT_CREATE_BLOCK` to the block number where the contract was deployed.

### Run The Demo

```
❯ yarn demo
yarn run v1.22.15
$ node src/minimal-demo.js
web3-shh package will be deprecated in version 1.3.5 and will no longer be supported.
web3-bzz package will be deprecated in version 1.3.5 and will no longer be supported.
Sending deposit transaction...
https://testnet.bscscan.com/tx/0x7b6f5590ff5c086fe52a1fd51dc2ea3bb59237855055eecc431054de1c6ffb58
Deposited note: anonymous-bnb-0.01-97-0x5236e309785026273549c42b93f05348acc6546d8e05cd22d4081017097ed53f58371871ccae4205daa159a770eeeb71a24c17efa5eb6cc59833eb6476bc
Getting contract state...
Generating SNARK proof...
Sending withdrawal transaction...
https://testnet.bscscan.com/tx/0x2cfbdf1b86891b432ef963405aa6a8ef20387ac062bbc02f6225c6eeb8deff55
Done
✨  Done in 19.49s.
```
