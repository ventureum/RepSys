'use strict'

const WWeb3 = require('web3')

const BigNumber = WWeb3.BigNumber

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const ReputationSystem = artifacts.require('./ReputationSystem.sol')
const CarbonVoteXCore = artifacts.require('carbonvotex/contracts/CarbonVoteXCore.sol')
const Web3 = require('web3')
const web3 = new Web3()
const PSEUDO_PRICE_ONE = 1
const PRICE_GTE_ONE_TRUE = true
const MIN_START_TIME = 100
const MAX_START_TIME = 200
const CONTEXT_TYPE_ONE = 'one'
const CONTEXT_TYPE_TWO = 'two'
const TOTAL_VOTES_LIMIT = 100
const CONTEXT_TYPES = [CONTEXT_TYPE_ONE, CONTEXT_TYPE_TWO]
const NAMESPACE_REPUTATION_SYSTEM = 'ReputationSystem'
const DELAY_LENGTH = 20
const POLL_LENGTH = 20

contract('ReputationSystem', accounts => {
  const ROOT_ACCOUNT = accounts[0]
  const MASTER_ACCOUNT = accounts[1]
  const VOTER_ACCOUNT_ONE = accounts[2]
  const VOTER_ACCOUNT_TWO = accounts[3]
  const MEMBER_ACCOUNT_ONE = accounts[4]
  const MEMBER_ACCOUNT_TWO = accounts[5]
  const MEMBER_ACCOUNT_THREE = accounts[6]
  const MEMBER_ACCOUNT_FOUR = accounts[7]
  const REGISTER_ACCOUNT = accounts[8]
  const TOKEN_ADDRESS = accounts[9]
  let reputationSystem
  let carbonVoteXCore
  let reputationSystemAddress
  let carbonVoteXCoreAddress

  before(async () => {
    carbonVoteXCore = await CarbonVoteXCore.deployed()
    reputationSystem = await ReputationSystem.deployed()
    reputationSystemAddress = reputationSystem.address
    carbonVoteXCoreAddress = carbonVoteXCore.address
    await carbonVoteXCore.setReceiver(
      web3.utils.sha3(NAMESPACE_REPUTATION_SYSTEM),
      reputationSystemAddress,
      [web3.utils.sha3('register')],
      {from: ROOT_ACCOUNT})
    await reputationSystem.setAddressCanRegister(REGISTER_ACCOUNT)
  })

  function toBytes32(str) {
    return str + "0".repeat(66 - str.length)
  }

  it('should contain the same carbonVoteXCore ' +
      'instance as the deployed carbonVoteXCore', async () => {
    assert.equal(
      await reputationSystem.carbonVoteXCore.call(),
      carbonVoteXCoreAddress)
  })

  it('should register PollRequest properly', async () => {
    let pollId = '0x01'
    await reputationSystem.registerPollRequest(
      pollId,
      MIN_START_TIME,
      MAX_START_TIME,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT})

    let pollRequest = await reputationSystem.pollRequests.call(pollId)
    assert.equal(
      pollRequest[0].toNumber(), MIN_START_TIME)
    assert.equal(
      pollRequest[1].toNumber(), MAX_START_TIME)
    assert.equal(
      pollRequest[2].toNumber(), PSEUDO_PRICE_ONE)
    assert.equal(
      pollRequest[3], PRICE_GTE_ONE_TRUE)
    assert.equal(pollRequest[4], TOKEN_ADDRESS)
  })

  it('should not re-register the same PollRequest', async () => {
    let pollId = '0x02'
    await reputationSystem.registerPollRequest(
      pollId,
      MIN_START_TIME,
      MAX_START_TIME,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT})

    try {
      await reputationSystem.registerPollRequest(
        pollId,
        MIN_START_TIME,
        MAX_START_TIME,
        PSEUDO_PRICE_ONE,
        PRICE_GTE_ONE_TRUE,
        TOKEN_ADDRESS,
        CONTEXT_TYPES,
        {from: REGISTER_ACCOUNT})
      assert.fail()
    } catch (err) {
      assert.ok(/revert/.test(err.message))
    }
  })

  it('should modify a PollRequest properly', async () => {
    let pollId = '0x03'
    let newMinStartTime = 200
    let newMaxStartTime = 300
    await reputationSystem.registerPollRequest(
      pollId,
      MIN_START_TIME,
      MAX_START_TIME,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT}
    )

    await reputationSystem.modifyPollRequest(
      pollId,
      newMinStartTime,
      newMaxStartTime,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT}
    )

    let pollRequest =
            await reputationSystem.pollRequests.call(pollId)
    assert.equal(
      pollRequest[0].toNumber(), newMinStartTime)
    assert.equal(
      pollRequest[1].toNumber(), newMaxStartTime)
    assert.equal(
      pollRequest[2].toNumber(), PSEUDO_PRICE_ONE)
    assert.equal(
      pollRequest[3], PRICE_GTE_ONE_TRUE)
    assert.equal(
      pollRequest[4], TOKEN_ADDRESS)
  })

  it('should not modify an unregistered PollRequest', async () => {
    let pollId = '0x04'
    try {
      await reputationSystem.modifyPollRequest(
        pollId,
        MIN_START_TIME,
        MAX_START_TIME,
        PSEUDO_PRICE_ONE,
        PRICE_GTE_ONE_TRUE,
        TOKEN_ADDRESS,
        CONTEXT_TYPES,
        {from: REGISTER_ACCOUNT}
      )
      assert.fail()
    } catch (err) {
      assert.ok(/revert/.test(err.message))
    }
  })

  it('should start multiple polls properly', async () => {
    let pollIdOne = '0x05'
    let pollIdTwo = '0x06'
    let projectId = 'project001'
    let currentTime = Math.floor(Date.now() / 1000)

    await reputationSystem.registerPollRequest(
      pollIdOne,
      currentTime - 50,
      currentTime + 50,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT}
    )

    await reputationSystem.registerPollRequest(
      pollIdTwo,
      currentTime - 50,
      currentTime + 50,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT}
    )

    await reputationSystem.startPoll(
      projectId,
      pollIdOne,
      DELAY_LENGTH,
      POLL_LENGTH,
      {from: REGISTER_ACCOUNT})

    await reputationSystem.startPoll(
      projectId,
      pollIdTwo,
      DELAY_LENGTH,
      POLL_LENGTH,
      {from: REGISTER_ACCOUNT})

    let project =
          await reputationSystem.idToProject.call(projectId)
    assert.equal(
      project[0].toNumber(), 2)

    assert.equal(await reputationSystem.pollExist.call(pollIdTwo), true)
    assert.equal(await reputationSystem.pollExist.call(pollIdOne), true)
  })

  it('should not start a poll without auth from carbonVoteXCore', async () => {
    let pollId = '0x07'

    let projectId = 'project002'
    let currentTime = Math.floor(Date.now() / 1000)

    await reputationSystem.registerPollRequest(
      pollId,
      currentTime - 50,
      currentTime + 50,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT}
    )

    // remove auth to register poll
    await carbonVoteXCore.cancelPermissions(
      [web3.utils.sha3('register')],
      [reputationSystemAddress])

    try {
      await reputationSystem.startPoll(
        projectId,
        pollId,
        DELAY_LENGTH,
        POLL_LENGTH,
        {from: REGISTER_ACCOUNT})
      assert.fail()
    } catch (err) {
      assert.ok(/revert/.test(err.message))
    }

    // restore auth from carbonVoteXCore to register poll
    await carbonVoteXCore.setPermissions(
      [web3.utils.sha3('register')],
      [reputationSystemAddress])
  })

  it('should vote properly', async () => {
    let pollId = '0x08'
    let projectId = 'project003'
    let currentTime = Math.floor(Date.now() / 1000)
    let votesInWeiForContextTypeOneAndMemberOne = 50
    let votesInWeiForContextTypeOneAndMemberTwo = 10
    let votesInWeiForContextTypeTwoAndMemberOne = 20
    let votesInWeiForContextTypeTwoAndMemberTwo = 60

    await reputationSystem.registerPollRequest(
      pollId,
      currentTime - 50,
      currentTime + 50,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT}
    )

    await reputationSystem.startPoll(
      projectId,
      pollId,
      DELAY_LENGTH,
      POLL_LENGTH,
      {from: REGISTER_ACCOUNT})

    assert.equal(await reputationSystem.pollExist.call(pollId), true)

    // set up upper vote limit for voters
    await carbonVoteXCore.writeAvailableVotes(
      web3.utils.sha3(NAMESPACE_REPUTATION_SYSTEM),
      pollId,
      VOTER_ACCOUNT_ONE,
      TOTAL_VOTES_LIMIT,
      {from: MASTER_ACCOUNT})

    // check availableVotes for voter
    let availableVotesForContextTypeOne = await
      reputationSystem.readAvailableVotesForContextType(
        pollId, VOTER_ACCOUNT_ONE, CONTEXT_TYPE_ONE)
    assert.equal(
      availableVotesForContextTypeOne.toNumber(), TOTAL_VOTES_LIMIT)

    let availableVotesForContextTypeTwo = await
      reputationSystem.readAvailableVotesForContextType(
        pollId, VOTER_ACCOUNT_ONE, CONTEXT_TYPE_TWO)
    assert.equal(
      availableVotesForContextTypeTwo.toNumber(), TOTAL_VOTES_LIMIT)

    // vote for context types
    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_ONE,
      CONTEXT_TYPE_ONE,
      pollId,
      votesInWeiForContextTypeOneAndMemberOne,
      {from: VOTER_ACCOUNT_ONE}
    )

    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_TWO,
      CONTEXT_TYPE_TWO,
      pollId,
      votesInWeiForContextTypeTwoAndMemberTwo,
      {from: VOTER_ACCOUNT_ONE}
    )

    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_TWO,
      CONTEXT_TYPE_ONE,
      pollId,
      votesInWeiForContextTypeOneAndMemberTwo,
      {from: VOTER_ACCOUNT_ONE}
    )

    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_ONE,
      CONTEXT_TYPE_TWO,
      pollId,
      votesInWeiForContextTypeTwoAndMemberOne,
      {from: VOTER_ACCOUNT_ONE}
    )

    // check vote results for voter
    let votesForContextOneByVoterOne =
            await reputationSystem.getVotingResultForContextTypeByVoter.call(
        pollId, VOTER_ACCOUNT_ONE, CONTEXT_TYPE_ONE)
    assert.equal(
      votesForContextOneByVoterOne,
      votesInWeiForContextTypeOneAndMemberTwo +
                votesInWeiForContextTypeOneAndMemberOne)

    let votesForContextTwoByVoterOne =
            await reputationSystem.getVotingResultForContextTypeByVoter.call(
        pollId, VOTER_ACCOUNT_ONE, CONTEXT_TYPE_TWO)
    assert.equal(
      votesForContextTwoByVoterOne,
      votesInWeiForContextTypeTwoAndMemberTwo +
          votesInWeiForContextTypeTwoAndMemberOne)

    // check project-specific reputation
    let votesForContextOneAndMemeberOne =
      await reputationSystem.getVotesInWeiForMember.call(
        projectId, MEMBER_ACCOUNT_ONE, CONTEXT_TYPE_ONE)
    assert.equal(
      votesForContextOneAndMemeberOne[0].toNumber(), 0)
    assert.equal(
      votesForContextOneAndMemeberOne[1].toNumber(),
      votesInWeiForContextTypeOneAndMemberOne)

    let votesForContextOneAndMemeberTwo =
      await reputationSystem.getVotesInWeiForMember.call(
        projectId, MEMBER_ACCOUNT_TWO, CONTEXT_TYPE_ONE)
    assert.equal(
      votesForContextOneAndMemeberTwo[0].toNumber(), 0)
    assert.equal(
      votesForContextOneAndMemeberTwo[1].toNumber(),
      votesInWeiForContextTypeOneAndMemberTwo)

    let votesForContextTwoAndMemeberOne =
      await reputationSystem.getVotesInWeiForMember.call(
        projectId, MEMBER_ACCOUNT_ONE, CONTEXT_TYPE_TWO)
    assert.equal(
      votesForContextTwoAndMemeberOne[0].toNumber(), 0)
    assert.equal(
      votesForContextTwoAndMemeberOne[1].toNumber(),
      votesInWeiForContextTypeTwoAndMemberOne)

    let votesForContextTwoAndMemeberTwo =
      await reputationSystem.getVotesInWeiForMember.call(
        projectId, MEMBER_ACCOUNT_TWO, CONTEXT_TYPE_TWO)
    assert.equal(
      votesForContextTwoAndMemeberTwo[0].toNumber(), 0)
    assert.equal(
      votesForContextTwoAndMemeberTwo[1].toNumber(),
      votesInWeiForContextTypeTwoAndMemberTwo)

    // check global reputation
    let globalReputationsSystemID =
            web3.utils.sha3(reputationSystem.address)

    let globalVotesForContextOneAndMemeberOne =
      await reputationSystem.getVotesInWeiForMember.call(
        globalReputationsSystemID, MEMBER_ACCOUNT_ONE, CONTEXT_TYPE_ONE)
    assert.equal(
      globalVotesForContextOneAndMemeberOne[0].toNumber(), 0)
    assert.equal(
      globalVotesForContextOneAndMemeberOne[1].toNumber(),
      votesInWeiForContextTypeOneAndMemberOne)

    let globalVotesForContextOneAndMemeberTwo =
      await reputationSystem.getVotesInWeiForMember.call(
        globalReputationsSystemID, MEMBER_ACCOUNT_TWO, CONTEXT_TYPE_ONE)
    assert.equal(
      globalVotesForContextOneAndMemeberTwo[0].toNumber(), 0)
    assert.equal(
      globalVotesForContextOneAndMemeberTwo[1].toNumber(),
      votesInWeiForContextTypeOneAndMemberTwo)

    let globalVotesForContextTwoAndMemeberOne =
      await reputationSystem.getVotesInWeiForMember.call(
        globalReputationsSystemID, MEMBER_ACCOUNT_ONE, CONTEXT_TYPE_TWO)
    assert.equal(
      globalVotesForContextTwoAndMemeberOne[0].toNumber(), 0)
    assert.equal(
      globalVotesForContextTwoAndMemeberOne[1].toNumber(),
      votesInWeiForContextTypeTwoAndMemberOne)

    let globalVotesForContextTwoAndMemeberTwo =
      await reputationSystem.getVotesInWeiForMember.call(
        globalReputationsSystemID, MEMBER_ACCOUNT_TWO, CONTEXT_TYPE_TWO)
    assert.equal(
      globalVotesForContextTwoAndMemeberTwo[0].toNumber(), 0)
    assert.equal(
      globalVotesForContextTwoAndMemeberTwo[1].toNumber(),
      votesInWeiForContextTypeTwoAndMemberTwo)
  })

  it('should update RepVecContext votes in a batch properly', async () => {
    let pollId = '0x09'
    let projectId = 'project004'
    let currentTime = Math.floor(Date.now() / 1000)
    let votesInWeiForContextTypeOneAndMemberThree = 90
    let votesInWeiForContextTypeOneAndMemberFour = 10
    let votesInWeiForContextTypeTwoAndMemberThree = 2
    let votesInWeiForContextTypeTwoAndMemberFour = 63

    await reputationSystem.registerPollRequest(
      pollId,
      currentTime - 20,
      currentTime + 20,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT})

    await reputationSystem.startPoll(
      projectId,
      pollId,
      DELAY_LENGTH,
      POLL_LENGTH,
      {from: REGISTER_ACCOUNT})

    // set up upper vote limit for voters
    await carbonVoteXCore.writeAvailableVotes(
      web3.utils.sha3(NAMESPACE_REPUTATION_SYSTEM),
      pollId,
      VOTER_ACCOUNT_TWO,
      TOTAL_VOTES_LIMIT,
      {from: MASTER_ACCOUNT})

    // vote for context types
    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_THREE,
      CONTEXT_TYPE_ONE,
      pollId,
      votesInWeiForContextTypeOneAndMemberThree,
      {from: VOTER_ACCOUNT_TWO})

    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_FOUR,
      CONTEXT_TYPE_TWO,
      pollId,
      votesInWeiForContextTypeTwoAndMemberFour,
      {from: VOTER_ACCOUNT_TWO})

    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_FOUR,
      CONTEXT_TYPE_ONE,
      pollId,
      votesInWeiForContextTypeOneAndMemberFour,
      {from: VOTER_ACCOUNT_TWO})

    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_THREE,
      CONTEXT_TYPE_TWO,
      pollId,
      votesInWeiForContextTypeTwoAndMemberThree,
      {from: VOTER_ACCOUNT_TWO})

    // update RepVec Context
    await reputationSystem.batchUpdateRepVecContext(
      projectId,
      MEMBER_ACCOUNT_THREE,
      [CONTEXT_TYPE_ONE, CONTEXT_TYPE_TWO],
      true,
      false,
      {from: REGISTER_ACCOUNT})

    await reputationSystem.batchUpdateRepVecContext(
      projectId,
      MEMBER_ACCOUNT_FOUR,
      [CONTEXT_TYPE_ONE, CONTEXT_TYPE_TWO],
      true,
      false,
      {from: REGISTER_ACCOUNT})

    // check project-specific reputation
    let votesForContextOneAndMemeberThree =
      await reputationSystem.getVotesInWeiForMember.call(
        projectId, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_ONE)
    assert.equal(
      votesForContextOneAndMemeberThree[0].toNumber(),
      votesInWeiForContextTypeOneAndMemberThree)
    assert.equal(
      votesForContextOneAndMemeberThree[1].toNumber(), 0)
    assert.equal(
      await reputationSystem.getVotingResultForMember.call(
        pollId, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_ONE),
      votesInWeiForContextTypeOneAndMemberThree)

    let votesForContextOneAndMemeberFour =
      await reputationSystem.getVotesInWeiForMember.call(
        projectId, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_ONE)
    assert.equal(
      votesForContextOneAndMemeberFour[0].toNumber(),
      votesInWeiForContextTypeOneAndMemberFour)
    assert.equal(
      votesForContextOneAndMemeberFour[1].toNumber(), 0)
    assert.equal(
      await reputationSystem.getVotingResultForMember.call(
        pollId, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_ONE),
      votesInWeiForContextTypeOneAndMemberFour)

    let votesForContextTwoAndMemeberThree =
      await reputationSystem.getVotesInWeiForMember.call(
        projectId, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_TWO)
    assert.equal(
      votesForContextTwoAndMemeberThree[0].toNumber(),
      votesInWeiForContextTypeTwoAndMemberThree)
    assert.equal(
      votesForContextTwoAndMemeberThree[1].toNumber(), 0)
    assert.equal(
      await reputationSystem.getVotingResultForMember.call(
        pollId, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_TWO),
      votesInWeiForContextTypeTwoAndMemberThree)

    let votesForContextTwoAndMemeberFour =
      await reputationSystem.getVotesInWeiForMember.call(
        projectId, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_TWO)
    assert.equal(
      votesForContextTwoAndMemeberFour[0].toNumber(),
      votesInWeiForContextTypeTwoAndMemberFour)
    assert.equal(
      votesForContextTwoAndMemeberFour[1].toNumber(), 0)
    assert.equal(
      await reputationSystem.getVotingResultForMember.call(
        pollId, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_TWO),
      votesInWeiForContextTypeTwoAndMemberFour)

    // check global reputation
    let globalReputationsSystemID =
            web3.utils.sha3(reputationSystem.address)

    let globalVotesForContextOneAndMemeberThree =
      await reputationSystem.getVotesInWeiForMember.call(
        globalReputationsSystemID, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_ONE)
    assert.equal(
      globalVotesForContextOneAndMemeberThree[0].toNumber(),
      votesInWeiForContextTypeOneAndMemberThree)
    assert.equal(
      globalVotesForContextOneAndMemeberThree[1].toNumber(), 0)

    let globalVotesForContextOneAndMemeberFour =
      await reputationSystem.getVotesInWeiForMember.call(
        globalReputationsSystemID, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_ONE)
    assert.equal(
      globalVotesForContextOneAndMemeberFour[0].toNumber(),
      votesInWeiForContextTypeOneAndMemberFour)
    assert.equal(
      globalVotesForContextOneAndMemeberFour[1].toNumber(), 0)

    let globalVotesForContextTwoAndMemeberThree =
      await reputationSystem.getVotesInWeiForMember.call(
        globalReputationsSystemID, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_TWO)
    assert.equal(
      globalVotesForContextTwoAndMemeberThree[0].toNumber(),
      votesInWeiForContextTypeTwoAndMemberThree)
    assert.equal(
      globalVotesForContextTwoAndMemeberThree[1].toNumber(), 0)

    let globalVotesForContextTwoAndMemeberFour =
      await reputationSystem.getVotesInWeiForMember.call(
        globalReputationsSystemID, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_TWO)
    assert.equal(
      globalVotesForContextTwoAndMemeberFour[0].toNumber(),
      votesInWeiForContextTypeTwoAndMemberFour)
    assert.equal(
      globalVotesForContextTwoAndMemeberFour[1].toNumber(), 0)
  })

  it('should not allow to vote more than limited ', async () => {
    let pollId = '0x0a'
    let projectId = 'project005'
    let currentTime = Math.floor(Date.now() / 1000)
    let votesInWeiForContextTypeOneAndMemberThree = 90
    let votesInWeiForContextTypeOneAndMemberFour = 5
    let votesInWeiForContextTypeTwoAndMemberThree = 50
    let votesInWeiForContextTypeTwoAndMemberFour = 63

    await reputationSystem.registerPollRequest(
      pollId,
      currentTime - 20,
      currentTime + 20,
      PSEUDO_PRICE_ONE,
      PRICE_GTE_ONE_TRUE,
      TOKEN_ADDRESS,
      CONTEXT_TYPES,
      {from: REGISTER_ACCOUNT})

    await reputationSystem.startPoll(
      projectId,
      pollId,
      DELAY_LENGTH,
      POLL_LENGTH,
      {from: REGISTER_ACCOUNT})

    // set up upper vote limit for voters
    await carbonVoteXCore.writeAvailableVotes(
      web3.utils.sha3(NAMESPACE_REPUTATION_SYSTEM),
      pollId,
      VOTER_ACCOUNT_TWO,
      TOTAL_VOTES_LIMIT,
      {from: MASTER_ACCOUNT})

    // vote for context types
    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_THREE,
      CONTEXT_TYPE_ONE,
      pollId,
      votesInWeiForContextTypeOneAndMemberThree,
      {from: VOTER_ACCOUNT_TWO})

    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_FOUR,
      CONTEXT_TYPE_TWO,
      pollId,
      votesInWeiForContextTypeTwoAndMemberFour,
      {from: VOTER_ACCOUNT_TWO})

    await reputationSystem.vote(
      projectId,
      MEMBER_ACCOUNT_FOUR,
      CONTEXT_TYPE_ONE,
      pollId,
      votesInWeiForContextTypeOneAndMemberFour,
      {from: VOTER_ACCOUNT_TWO})

    try {
      await reputationSystem.vote(
        projectId,
        MEMBER_ACCOUNT_THREE,
        CONTEXT_TYPE_TWO,
        pollId,
        votesInWeiForContextTypeTwoAndMemberThree,
        {from: VOTER_ACCOUNT_TWO})
      assert.fail()
    } catch (err) {
      assert.ok(/invalid opcode/.test(err.message))
    }
  })

  it('should not register from root address', async () => {
    let pollId = '0x0b'

    try {
      await reputationSystem.registerPollRequest(
        pollId,
        MIN_START_TIME,
        MAX_START_TIME,
        PSEUDO_PRICE_ONE,
        PRICE_GTE_ONE_TRUE,
        TOKEN_ADDRESS,
        CONTEXT_TYPES,
        {from: ROOT_ACCOUNT})
      assert.fail()
    } catch (err) {
      assert.ok(/revert/.test(err.message))
    }
  })

  it('should set RepVec success', async () => {
    let mockId = '0xabc'
    let mockAddress = VOTER_ACCOUNT_ONE
    let mockContextType = "0x123abc"
    let mockLastUpdated = 101
    let mockUpdatedBlockNumber = 10101
    let mockVotes = 11101
    let mockPollIdsForPendingVotes = ["0x1f001a", "0x1f0019"]
    let mockVotesForPendingVotes = [11, 12]
    let mockTotalPendingVotes = 1001101

    let { logs } = await reputationSystem.setRepVec(
      mockId,
      mockAddress,
      mockContextType,
      mockLastUpdated,
      mockUpdatedBlockNumber,
      mockVotes,
      mockPollIdsForPendingVotes,
      mockVotesForPendingVotes,
      mockTotalPendingVotes).should.be.fulfilled

    const event = logs.find(e => e.event === 'SetRepVec')
    should.exist(event)

    event.args.requester.should.be.equal(ROOT_ACCOUNT)
    event.args.reputationSystemId.should.be.equal(toBytes32(mockId))
    event.args.memberAddress.should.be.equal(mockAddress)
    event.args.contextType.should.be.equal(toBytes32(mockContextType))
    event.args.lastUpdated.should.be.bignumber.equal(mockLastUpdated)
    event.args.updatedBlockNumber
      .should.be.bignumber.equal(mockUpdatedBlockNumber)
    event.args.votes.should.be.bignumber.equal(mockVotes)
    event.args.totalPendingVotes
      .should.be.bignumber.equal(mockTotalPendingVotes)


    const event2 = logs.find(e => e.event === 'SetPendingVotes')
    should.exist(event2)

    const pollIds = event2.args.pollIdsForPendingVotes
    for (var i = 0; i < pollIds.length; i++) {
      pollIds[i].should.be.equal(toBytes32(mockPollIdsForPendingVotes[i]))
    }

    const votes = event2.args.votesForPendingVotes
    for (var i = 0; i < votes.length; i++) {
      votes[i].toString().should.be.bignumber.equal(mockVotesForPendingVotes[i])
    }
  })
})
