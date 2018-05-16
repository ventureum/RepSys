var ReputationSystem = artifacts.require("./ReputationSystem.sol");

module.exports = function (deployer, network, accounts){
    deployer.deploy(ReputationSystem, accounts[0]);
}
