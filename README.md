# Reputation System

## Design Doc

Reputation System: https://github.com/ventureum/Documents/wiki/Reputation-System

## Tools and Reference

* docker image `ventureum/dev`(https://hub.docker.com/r/ventureum/dev/) is used to build codes 

* `truffle` is used to set up development environment, testing framework and asset pipeline for Ethereum

* Fast Ethereum RPC client `ganache-cli` is used for testing (https://github.com/trufflesuite/ganache-cli)

* `openzeppelin-solidity` library (https://github.com/OpenZeppelin/openzeppelin-solidity) is used to 
  provide the ERC20 interface, on which my VoteToken implementation is based.
  
* CarbonVoteX is referenced as vote system from https://www.npmjs.com/package/carbonvotex?activeTab=versions

## Files
In `contracts` folder:
  * ReputationSystem.sol - implementation for ReputationSystem Contract

In `migrations` folder:
  * 2_deploy_contracts.js - implementation for migrations deployment

In root:
  * truffle.js - networks setting for Truffle configuration
  * run_test.sh - script for testing including 
    ```
    rm -rf build/
    truffle compile
    truffle migrate --reset
    truffle test
    ``` 

## Test Workflow

1. downlaod docker image `ventureum/dev` and run container in local

2. log into the docker conatiner，and git clone codes https://github.com/ventureum/RepSys.git into local repo

3. install packages that may be missing 
   ```
   npm init -y
   npm install -g ganache-cli
   npm install -E openzeppelin-solidity
   ``` 
4. run `ganache-cli`

5. open a new terminal, log into the same docker conatiner, and run `./run_test.sh` under the root of venturem_interview

## Test Result

TBA