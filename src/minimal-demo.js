require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const assert = require('assert')
const { bigInt } = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const merkleTree = require('fixed-merkle-tree')
const Web3 = require('web3')
const buildGroth16 = require('websnark/src/groth16')
const websnarkUtils = require('websnark/src/utils')
const { toWei, toBN, fromWei } = require('web3-utils')

let web3, contract, netId, circuit, proving_key, groth16
const MERKLE_TREE_HEIGHT = process.env.MERKLE_TREE_HEIGHT
const PRIVATE_KEY = process.env.PRIVATE_KEY
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const CONTRACT_CREATE_BLOCK = parseInt(process.env.CONTRACT_CREATE_BLOCK)
const AMOUNT = process.env.ETH_AMOUNT
const RELAYER_URL = process.env.RELAYER_URL
const RPC_URL = process.env.RPC_URL
const BLOCK_EXPLORER_URL = process.env.BLOCK_EXPLORER_URL
console.log({ RELAYER_URL, RPC_URL, BLOCK_EXPLORER_URL })

/** Generate random number of specified byte length */
const rbigint = (nbytes) => bigInt.leBuff2int(crypto.randomBytes(nbytes))

/** Compute pedersen hash */
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]

/** BigNumber to hex string of specified length */
const toHex = (number, length = 32) =>
  '0x' +
  (number instanceof Buffer ? number.toString('hex') : bigInt(number).toString(16)).padStart(length * 2, '0')

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

const waitForRecipient = async (transactonHash) => {
  let transactionReceipt = null
  while (transactionReceipt == null) { // Waiting expectedBlockTime until the transaction is mined
    transactionReceipt = await web3.eth.getTransactionReceipt(transactonHash);
    await sleep(3000)
  }
}

/**
 * Waits for transaction to be mined
 * @param txHash Hash of transaction
 * @param attempts
 * @param delay
 */
function waitForTxReceipt({ txHash, attempts = 60, delay = 1000 }) {
  return new Promise((resolve, reject) => {
    const checkForTx = async (txHash, retryAttempt = 0) => {
      const result = await web3.eth.getTransactionReceipt(txHash)
      if (!result || !result.blockNumber) {
        if (retryAttempt <= attempts) {
          setTimeout(() => checkForTx(txHash, retryAttempt + 1), delay)
        } else {
          reject(new Error('tx was not mined'))
        }
      } else {
        resolve(result)
      }
    }
    checkForTx(txHash)
  })
}

function getStatus(id, relayerURL) {
  return new Promise((resolve) => {
    async function getRelayerStatus() {
      const responseStatus = await axios.get(relayerURL + '/v1/jobs/' + id)

      if (responseStatus.status === 200) {
        const { txHash, status, confirmations, failedReason } = responseStatus.data

        console.log(`Current job status ${status}, confirmations: ${confirmations}`)

        if (status === 'FAILED') {
          throw new Error(status + ' failed reason:' + failedReason)
        }

        if (status === 'CONFIRMED') {
          const receipt = await waitForTxReceipt({ txHash })
          console.log(
            `Transaction submitted through the relay. View transaction on bscscan ${BLOCK_EXPLORER_URL}/tx/${txHash}`,
          )
          console.log('Transaction mined in block', receipt.blockNumber)
          resolve(status)
        }
      }

      setTimeout(() => {
        getRelayerStatus(id, relayerURL)
      }, 3000)
    }

    getRelayerStatus()
  })
}

/**
 * Create deposit object from secret and nullifier
 */
function createDeposit(nullifier, secret) {
  let deposit = { nullifier, secret }
  deposit.preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
  deposit.commitment = pedersenHash(deposit.preimage)
  deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31))
  return deposit
}

/**
 * Make an ETH deposit
 */
async function deposit() {
  const deposit = createDeposit(rbigint(31), rbigint(31))
  console.log('Sending deposit transaction...')
  const tx = await contract.methods
    .deposit(toHex(deposit.commitment))
    .send({ value: toWei(AMOUNT), from: web3.eth.defaultAccount, gas: 2e6 })
  console.log(`${BLOCK_EXPLORER_URL}/tx/${tx.transactionHash}`)
  await waitForRecipient(tx.transactionHash)
  return `anonymous-bnb-${AMOUNT}-${netId}-${toHex(deposit.preimage, 62)}`
}

/**
 * Do an ETH withdrawal
 * @param note Note to withdraw
 * @param recipient Recipient address
 */
async function withdraw(note, recipient) {
  const deposit = parseNote(note)
  const { proof, args } = await generateSnarkProof(deposit, recipient)
  console.log('Sending withdrawal transaction...')
  const tx = await contract.methods.withdraw(proof, ...args).send({ from: web3.eth.defaultAccount, gas: 1e6 })
  console.log(`${BLOCK_EXPLORER_URL}/tx/${tx.transactionHash}`)
}

async function withdrawViaRelayer(note, recipient, relayerURL) {
  console.log({ note, recipient, relayerURL })
  const deposit = parseNote(note)
  console.log(deposit)
  console.log(relayerURL + '/status')
  const relayerStatus = await axios.get(relayerURL + '/status')
  console.log(relayerStatus.data)
  const withdrawContract = relayerStatus.data.instances.bnb.instanceAddress[deposit.amount]
  console.log({ withdrawContract, addr: contract._address })
  const { rewardAccount, gasLimits, minGasPrice, relayerServiceFeeRate } = relayerStatus.data
  console.log({ rewardAccount, gasLimits, minGasPrice, relayerServiceFeeRate })
  // calculate fee
  // fee = minGasPrice * gasLimits.TORNADO_WITHDRAW + amount * tornadoServiceFee
  const relayerServiceFee = toBN(toWei(deposit.amount, 'ether'))
    .mul(toBN(relayerServiceFeeRate))
    .div(toBN('1000000'))
  const txFee = toBN(toWei(minGasPrice.toString(), 'gwei')).mul(toBN(gasLimits.TORNADO_WITHDRAW))
  const fee = relayerServiceFee.add(txFee)
  console.log(fromWei(relayerServiceFee), fromWei(txFee), fromWei(fee))
  const { proof, args } = await generateSnarkProof(
    deposit,
    recipient,
    bigInt(rewardAccount),
    bigInt(fee.toString()),
  )
  // const tx = await contract.methods.withdraw(proof, ...args).send({ from: web3.eth.defaultAccount, gas: 1e6 })
  // console.log(`${BLOCK_EXPLORER_URL}/tx/${tx.transactionHash}`)
  // return
  // console.log({ proof, args })
  // send withdrawal request to relayer
  const data = {
    proof,
    args,
    contract: withdrawContract,
    gasPrice: toWei(minGasPrice.toString(), 'gwei'),
  }
  console.log(data)
  const withdrawRes = await axios.post(relayerURL + '/v1/withdraw', data)
  console.log(withdrawRes.data)
  const { id } = withdrawRes.data

  const result = await getStatus(id, relayerURL)
  console.log('STATUS', result)
}

/**
 * Parses Anonymous.cash note
 * @param noteString the note
 */
function parseNote(noteString) {
  const noteRegex = /anonymous-(?<currency>\w+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{124})/g
  const match = noteRegex.exec(noteString)

  // we are ignoring `currency`, `amount`, and `netId` for this minimal example
  const buf = Buffer.from(match.groups.note, 'hex')
  const nullifier = bigInt.leBuff2int(buf.slice(0, 31))
  const secret = bigInt.leBuff2int(buf.slice(31, 62))
  // return createDeposit(nullifier, secret)
  return {
    currency: match.groups.currency,
    amount: match.groups.amount,
    netId: match.groups.netId,
    ...createDeposit(nullifier, secret),
  }
}

async function getPastEventsByStep(step = 5000) {
  let fromBlock = CONTRACT_CREATE_BLOCK
  const latestBlock = await web3.eth.getBlockNumber()
  let res = []
  while (1) {
    let toBlock = fromBlock + step - 1
    if (toBlock > latestBlock) {
      toBlock = latestBlock
    }
    const events = await contract.getPastEvents('Deposit', {
      fromBlock,
      toBlock,
    })
    res = res.concat(events)
    // console.log(`fromBlock: ${fromBlock}, toBlock: ${toBlock}, events: ${events}`)
    if (toBlock === latestBlock) {
      break
    } else {
      fromBlock = toBlock + 1
    }
  }
  return res
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the contract, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
async function generateMerkleProof(deposit) {
  console.log('Getting contract state...')
  const events = await getPastEventsByStep()
  const leaves = events
    .sort((a, b) => a.returnValues.leafIndex - b.returnValues.leafIndex) // Sort events in chronological order
    .map((e) => e.returnValues.commitment)
  const tree = new merkleTree(MERKLE_TREE_HEIGHT, leaves)

  // Find current commitment in the tree
  let depositEvent = events.find((e) => e.returnValues.commitment === toHex(deposit.commitment))
  let leafIndex = depositEvent ? depositEvent.returnValues.leafIndex : -1

  // Validate that our data is correct (optional)
  const isValidRoot = await contract.methods.isKnownRoot(toHex(tree.root())).call()
  const isSpent = await contract.methods.isSpent(toHex(deposit.nullifierHash)).call()
  assert(isValidRoot === true, 'Merkle tree is corrupted')
  assert(isSpent === false, 'The note is already spent')
  assert(leafIndex >= 0, 'The deposit is not found in the tree')

  // Compute merkle proof of our commitment
  const { pathElements, pathIndices } = tree.path(leafIndex)
  return { pathElements, pathIndices, root: tree.root() }
}

/**
 * Generate SNARK proof for withdrawal
 * @param deposit Deposit object
 * @param recipient Funds recipient
 */
async function generateSnarkProof(deposit, recipient, relayer = 0, fee = 0) {
  // Compute merkle proof of our commitment
  const { root, pathElements, pathIndices } = await generateMerkleProof(deposit)

  // Prepare circuit input
  const input = {
    // Public snark inputs
    root: root,
    nullifierHash: deposit.nullifierHash,
    recipient: bigInt(recipient),
    relayer,
    fee,
    refund: 0,

    // Private snark inputs
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: pathElements,
    pathIndices: pathIndices,
  }

  console.log('Generating SNARK proof...')
  const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key)
  const { proof } = websnarkUtils.toSolidityInput(proofData)

  const args = [
    toHex(input.root),
    toHex(input.nullifierHash),
    toHex(input.recipient, 20),
    toHex(input.relayer, 20),
    toHex(input.fee),
    toHex(input.refund),
  ]

  return { proof, args }
}

async function main() {
  web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL, { timeout: 5 * 60 * 1000 }), null, {
    transactionConfirmationBlocks: 1,
  })
  circuit = require(__dirname + '/../assets/circuits/withdraw.json')
  proving_key = fs.readFileSync(__dirname + '/../assets/circuits/withdraw_proving_key.bin').buffer
  groth16 = await buildGroth16()
  netId = await web3.eth.net.getId()
  contract = new web3.eth.Contract(require('../build/contracts/ETHAnonymous.json').abi, CONTRACT_ADDRESS)
  const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY)
  web3.eth.accounts.wallet.add(PRIVATE_KEY)
  // eslint-disable-next-line require-atomic-updates
  web3.eth.defaultAccount = account.address

  const note = await deposit()
  console.log('Deposited note:', note)
  if(RELAYER_URL) {
    await withdrawViaRelayer(note, web3.eth.defaultAccount, RELAYER_URL)
  } else {
    await withdraw(note, web3.eth.defaultAccount)
  }
  console.log('Done')
  process.exit()
}

main()
