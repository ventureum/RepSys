var HDWalletProvider = require('truffle-hdwallet-provider')
var mnemonic = 'effort gospel broken fatigue taste mountain rule uncover radio caught metal nation'

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 5000000
      provider: new HDWalletProvider(mnemonic, "http://localhost:8545",0, 9)
    }
  }
}
