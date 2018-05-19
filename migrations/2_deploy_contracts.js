const ReputationSystem = artifacts.require("./ReputationSystem.sol");
const CarbonVoteX = artifacts.require("carbonvotex/contracts/CarbonVoteX.sol");


module.exports = function (deployer, network, accounts){
    deployer.then(async () => {
        await deployer.deploy(CarbonVoteX, accounts[0], [], []);
        await deployer.deploy(ReputationSystem, CarbonVoteX.address);
    });
}
