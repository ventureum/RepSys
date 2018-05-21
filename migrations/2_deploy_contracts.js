const ReputationSystem = artifacts.require("./ReputationSystem.sol");
const CarbonVoteXCore =
    artifacts.require("carbonvotex/contracts/CarbonVoteXCore.sol");
const Web3 = require ('web3');
const web3 = new Web3();


module.exports = function (deployer, network, accounts){
    const namespace = web3.utils.sha3("ReputationSystem");
    deployer.then(async () => {
        await deployer.deploy(CarbonVoteXCore, accounts[1]);
        await deployer.deploy(
          ReputationSystem, namespace, CarbonVoteXCore.address);
    });
}
