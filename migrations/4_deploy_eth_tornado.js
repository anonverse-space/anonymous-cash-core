/* global artifacts */
require('dotenv').config({ path: '../.env' })
const ETHAnonymous = artifacts.require('ETHAnonymous')
const Verifier = artifacts.require('Verifier')
const Hasher = artifacts.require('Hasher')
const { toWei } = require('web3-utils')

module.exports = function (deployer) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT, ETH_AMOUNT } = process.env
    const verifier = await Verifier.deployed()
    const hasher = await Hasher.deployed()
    const anonymous = await deployer.deploy(
      ETHAnonymous,
      verifier.address,
      hasher.address,
      toWei(ETH_AMOUNT),
      MERKLE_TREE_HEIGHT,
    )
    console.log('ETHAnonymous address', anonymous.address)
  })
}
