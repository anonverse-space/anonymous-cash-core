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

### Run Demo With Relayer

Edit the `.env` file to add `RELAYER_URL` and run `yarn demo` again.

```bash
❯ yarn demo
yarn run v1.22.15
$ node src/minimal-demo.js
{
  RELAYER_URL: 'http://127.0.0.1:8000',
  RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  BLOCK_EXPLORER_URL: 'https://testnet.bscscan.com'
}
web3-shh package will be deprecated in version 1.3.5 and will no longer be supported.
web3-bzz package will be deprecated in version 1.3.5 and will no longer be supported.
Sending deposit transaction...
https://testnet.bscscan.com/tx/0x44f776afe13aa4d64d473542c37cca4e3ee5186237268cc8dc345fc5dba1b3c0
Deposited note: anonymous-bnb-0.1-97-0xb1e0f56e736d7b30e4301185f374f986a8735dfc12613df86af3fde1002534846eebfbed16c06ff7969b556fd4576cd6b49784169fe0c3dfa1773e1ad2e9
Getting contract state...
Generating SNARK proof...
{
  proof: '0x1c1ac49b855240b67f7932876418e177fa9c4ff19bc699bb8079846c776eadcf302fa8f59580ded16b600d6eb0cf54094fefd0473e542e19271518ab3eb788e00aa9abbba9ea074340af47a5ffed0b4a96d37c9338010cd2878ea8ee515c2d3323bfee3fd9725226b007191867b15d7b8e45707c43c44e807fffce0e80bcb873146035f211c925492c17c747965b85a1e6d2ae2824e3e2107447aae00f93c9c7207dcd
d1428587a0fde92a4f75e215c6036c9252aa299215bff62cefb67f354b1086d161bab533eb042a7288927c130eb8f82cdd54987c5324f6be4117d03df50be47055f5224b38b5a9742fb3dc402d6d054caa51c57b5639e7bef2d4b8c11c',
  args: [
    '0x0254f1ea0b29473c206373ce8940c87677464c86175d15f17845c1daca725920',
    '0x089fc405e1c6566bdfefa3e1dc4a2cf579165206d6d092f9e856b8d1aef0f6bd',
    '0xe077159549c1a868290994ab3402de46eab11511',
    '0xe077159549c1a868290994ab3402de46eab11511',
    '0x0000000000000000000000000000000000000000000000000013b7b21280e000',
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  ],
  contract: '0xE614E6dF939740550Dd215995d9151Cd0C0e4941',
  gasPrice: '10000000000'
}
{ id: '1509d7ab-cdb9-4577-bca3-bd4d7464db8f' }
Current job status ACCEPTED, confirmations: undefined
Current job status ACCEPTED, confirmations: undefined
Current job status ACCEPTED, confirmations: undefined
Current job status ACCEPTED, confirmations: undefined
Current job status ACCEPTED, confirmations: undefined
Current job status SENT, confirmations: undefined
Current job status SENT, confirmations: undefined
Current job status SENT, confirmations: undefined
Current job status CONFIRMED, confirmations: 1
Transaction submitted through the relay. View transaction on bscscan https://https://testnet.bscscan.com/tx/0xd9d0ad6caee3e3b331fbe50d0cca18cb44ce30be02a53867559dd66d718ffca4
Transaction mined in block 14883550
STATUS CONFIRMED
Done
✨  Done in 37.32s.
```
