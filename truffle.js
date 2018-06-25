const HDWalletProvider = require('truffle-hdwallet-provider')
const fs = require('fs')

let mnemonic = ''

if (fs.existsSync('mnemonic.txt')) {
  mnemonic = fs.readFileSync("mnemonic.txt").toString().split('\n')[0]
}

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 5000000,
      provider: new HDWalletProvider(mnemonic, "http://localhost:8545",0, 9)
    },
    testing: {
      host: 'localhost',
      port: 8545,
      network_id: "*",
      gas: 6000000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
}
