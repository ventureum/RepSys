const ReputationSystem = artifacts.require("./ReputationSystem.sol");
const CarbonVoteX = artifacts.require("carbonvotex/contracts/CarbonVoteX.sol");
const Web3 = require ('web3');
const web3 = new Web3();
const PSEUDO_PRICE_ONE = 1;
const PRICE_GTE_ONE_TRUE = true;
const MIN_START_TIME = 100;
const MAX_START_TIME = 200;
const CONTEXT_TYPE_ONE = "one";
const CONTEXT_TYPE_TWO = "two";
const TOTAL_VOTES_LIMIT = 200;

contract('ReputationSystem', accounts => {
    const MASTER_ACCOUNT = accounts[0];
    const VOTER_ACCOUNT_ONE = accounts[1];
    const VOTER_ACCOUNT_TWO = accounts[2];
    const MEMBER_ACCOUNT_ONE = accounts[3];
    const MEMBER_ACCOUNT_TWO = accounts[4];
    const MEMBER_ACCOUNT_THREE = accounts[5];
    const MEMBER_ACCOUNT_FOUR = accounts[6];
    const REGISTER_ACCOUNT = accounts[7];
    const TOKEN_ADDRESS = accounts[8];
    let reputationSystem;
    let carbonVoteX;

    before(async() => {
        carbonVoteX = await CarbonVoteX.deployed();
        reputationSystem = await ReputationSystem.deployed();
    });

    it("should contain the same CarbonVoteX " +
      "instance as the deployed CarbonVoteX", async () => {
        assert.equal(
            await reputationSystem.carbon.call(),
            carbonVoteX.address);
    });

    it("should register PollRequest properly", async () => {
        let pollId = "0x01";
        await reputationSystem.registerPollRequest(
            pollId,
            MIN_START_TIME,
            MAX_START_TIME,
            PSEUDO_PRICE_ONE,
            PRICE_GTE_ONE_TRUE,
            TOKEN_ADDRESS,
            {from: REGISTER_ACCOUNT}
        );

        let pollRequest = await reputationSystem.pollRequests.call(pollId);
        assert.equal(
          pollRequest[0].toNumber(), MIN_START_TIME);
        assert.equal(
          pollRequest[1].toNumber(), MAX_START_TIME);
        assert.equal(
          pollRequest[2].toNumber(), PSEUDO_PRICE_ONE);
        assert.equal(
          pollRequest[3], PRICE_GTE_ONE_TRUE);
        assert.equal(pollRequest[4], TOKEN_ADDRESS);
    });

    it("should not re-register the same PollRequest", async () => {
        let pollId = "0x02";
        await reputationSystem.registerPollRequest(
            pollId,
            MIN_START_TIME,
            MAX_START_TIME,
            PSEUDO_PRICE_ONE,
            PRICE_GTE_ONE_TRUE,
            TOKEN_ADDRESS,
            {from: REGISTER_ACCOUNT}
        );

        try {
            await reputationSystem.registerPollRequest(
                pollId,
                MIN_START_TIME,
                MAX_START_TIME,
                PSEUDO_PRICE_ONE,
                PRICE_GTE_ONE_TRUE,
                TOKEN_ADDRESS,
                {from: REGISTER_ACCOUNT}
            );
            assert.fail();
        } catch (err) {
            assert.ok(/revert/.test(err.message));
        }
    });

    it("should modify a PollRequest properly", async () => {
        let pollId = "0x03";
        let newMinStartTime = 200;
        let newMaxStartTime = 300;
        await reputationSystem.registerPollRequest(
            pollId,
            MIN_START_TIME,
            MAX_START_TIME,
            PSEUDO_PRICE_ONE,
            PRICE_GTE_ONE_TRUE,
            TOKEN_ADDRESS,
            {from: REGISTER_ACCOUNT}
        );

        await reputationSystem.modifyPollRequest(
            pollId,
            newMinStartTime,
            newMaxStartTime,
            PSEUDO_PRICE_ONE,
            PRICE_GTE_ONE_TRUE,
            TOKEN_ADDRESS,
            {from: REGISTER_ACCOUNT}
        );

        let pollRequest =
            await reputationSystem.pollRequests.call(pollId);
        assert.equal(
          pollRequest[0].toNumber(), newMinStartTime);
        assert.equal(
          pollRequest[1].toNumber(), newMaxStartTime);
        assert.equal(
          pollRequest[2].toNumber(), PSEUDO_PRICE_ONE);
        assert.equal(
          pollRequest[3], PRICE_GTE_ONE_TRUE);
        assert.equal(
          pollRequest[4], TOKEN_ADDRESS);
    });

    it("should not modify an unregistered PollRequest", async () => {
        let pollId = "0x04";
        try {
          await reputationSystem.modifyPollRequest(
            pollId,
            MIN_START_TIME,
            MAX_START_TIME,
            PSEUDO_PRICE_ONE,
            PRICE_GTE_ONE_TRUE,
            TOKEN_ADDRESS,
            {from: REGISTER_ACCOUNT}
          );
          assert.fail();
        } catch (err) {
          assert.ok(/revert/.test(err.message));
        }
    });

    it("should start multiple polls properly", async () => {
        let pollIdOne = "0x05";
        let pollIdTwo = "0x06";
        let projectId = "project001";
        let currentTime = Math.floor(Date.now() / 1000);

        // gain auth from CarbonVoteX to register poll through ReputationSystem
        let register = await carbonVoteX.functionSig.call(
            web3.utils.sha3("register"));
        await carbonVoteX.permit(
            reputationSystem.address,
            carbonVoteX.address,
            register);

        await reputationSystem.registerPollRequest(
            pollIdOne,
            currentTime - 50,
            currentTime + 50,
            PSEUDO_PRICE_ONE,
            PRICE_GTE_ONE_TRUE,
            TOKEN_ADDRESS,
            {from: REGISTER_ACCOUNT}
        );

        await reputationSystem.registerPollRequest(
          pollIdTwo,
          currentTime - 50,
          currentTime + 50,
          PSEUDO_PRICE_ONE,
          PRICE_GTE_ONE_TRUE,
          TOKEN_ADDRESS,
          {from: REGISTER_ACCOUNT}
        );

        await reputationSystem.startPoll(
            projectId,
            pollIdOne,
            {from: REGISTER_ACCOUNT});

        await reputationSystem.startPoll(
            projectId,
            pollIdTwo,
            {from: REGISTER_ACCOUNT});

        let project =
          await reputationSystem.idToProject.call(projectId);

        assert.equal(
          project[0].toNumber(), 2);
    });


    it("should not start a poll without auth from CarbonVoteX", async () => {
        let pollId = "0x07";

        let projectId = "project002";
        let currentTime = Math.floor(Date.now() / 1000);

        await reputationSystem.registerPollRequest(
            pollId,
            currentTime - 50,
            currentTime + 50,
            PSEUDO_PRICE_ONE,
            PRICE_GTE_ONE_TRUE,
            TOKEN_ADDRESS,
            {from: REGISTER_ACCOUNT}
        );

        // remove auth to register poll from ReputationSystem
        let register = await carbonVoteX.functionSig.call(
            web3.utils.sha3("register"));
        await carbonVoteX.forbid(
            reputationSystem.address,
            carbonVoteX.address,
            register);

        try {
            await reputationSystem.startPoll(
                projectId,
                pollId,
                {from: REGISTER_ACCOUNT});
            assert.fail();
        } catch (err) {
            assert.ok(/revert/.test(err.message));
        }
    });

    it("should delegate votes properly", async () => {
        let pollId = "0x08";
        let projectId = "project003";
        let currentTime = Math.floor(Date.now() / 1000);
        let votesInWeiForContextTypeOneAndMemberOne = 50;
        let votesInWeiForContextTypeOneAndMemberTwo = 10;
        let votesInWeiForContextTypeTwoAndMemberOne = 20;
        let votesInWeiForContextTypeTwoAndMemberTwo = 60;

        // gain auth from CarbonVoteX to register poll through ReputationSystem
        let register = await carbonVoteX.functionSig.call(
            web3.utils.sha3("register"));
        await carbonVoteX.permit(
            reputationSystem.address,
            carbonVoteX.address,
            register);

        // gain auth from CarbonVoteX to voteFor through ReputationSystem
        let voteFor = await carbonVoteX.functionSig.call(
            web3.utils.sha3("voteFor"));
        await carbonVoteX.permit(
            reputationSystem.address,
            carbonVoteX.address,
            voteFor);

        await reputationSystem.registerPollRequest(
          pollId,
          currentTime - 50,
          currentTime + 50,
          PSEUDO_PRICE_ONE,
          PRICE_GTE_ONE_TRUE,
          TOKEN_ADDRESS,
          {from: REGISTER_ACCOUNT}
        );

        await reputationSystem.startPoll(
          projectId,
          pollId,
          {from: REGISTER_ACCOUNT});

        // set up upper vote limit for voters
        await carbonVoteX.writeAvailableVotes(
          pollId,
          VOTER_ACCOUNT_ONE,
          TOTAL_VOTES_LIMIT,
          {from: MASTER_ACCOUNT}
        );

        // check availableVotes for voter
        let availableVotes = await carbonVoteX.readAvailableVotes.call(
            pollId, VOTER_ACCOUNT_ONE);

        assert.equal(
            availableVotes.toNumber(), TOTAL_VOTES_LIMIT);

        // delegate votes
        await reputationSystem.delegate(
            projectId,
            MEMBER_ACCOUNT_ONE,
            CONTEXT_TYPE_ONE,
            pollId,
            votesInWeiForContextTypeOneAndMemberOne,
            {from: VOTER_ACCOUNT_ONE}
        );

        await reputationSystem.delegate(
          projectId,
          MEMBER_ACCOUNT_TWO,
          CONTEXT_TYPE_TWO,
          pollId,
          votesInWeiForContextTypeTwoAndMemberTwo,
          {from: VOTER_ACCOUNT_ONE}
        );

        await reputationSystem.delegate(
          projectId,
          MEMBER_ACCOUNT_TWO,
          CONTEXT_TYPE_ONE,
          pollId,
          votesInWeiForContextTypeOneAndMemberTwo,
          {from: VOTER_ACCOUNT_ONE}
        );

        await reputationSystem.delegate(
          projectId,
          MEMBER_ACCOUNT_ONE,
          CONTEXT_TYPE_TWO,
          pollId,
          votesInWeiForContextTypeTwoAndMemberOne,
          {from: VOTER_ACCOUNT_ONE}
        );


        // check vote results for voter
        let votesForContextOneByVoterOne =
            await carbonVoteX.getVotingResultByVoter.call(
              pollId, VOTER_ACCOUNT_ONE, CONTEXT_TYPE_ONE);
        assert.equal(
            votesForContextOneByVoterOne,
            votesInWeiForContextTypeOneAndMemberTwo +
                votesInWeiForContextTypeOneAndMemberOne);

        let votesForContextTwoByVoterOne =
            await carbonVoteX.getVotingResultByVoter.call(
                pollId, VOTER_ACCOUNT_ONE, CONTEXT_TYPE_TWO);
        assert.equal(
          votesForContextTwoByVoterOne,
          votesInWeiForContextTypeTwoAndMemberTwo +
          votesInWeiForContextTypeTwoAndMemberOne);

        // check project-specific reputation
        let votesForContextOneAndMemeberOne =
            await reputationSystem.getVotes.call(
                projectId, MEMBER_ACCOUNT_ONE, CONTEXT_TYPE_ONE);
        assert.equal(
            votesForContextOneAndMemeberOne[0].toNumber(), 0);
        assert.equal(
            votesForContextOneAndMemeberOne[1].toNumber(),
            votesInWeiForContextTypeOneAndMemberOne);

        let votesForContextOneAndMemeberTwo =
            await reputationSystem.getVotes.call(
                projectId, MEMBER_ACCOUNT_TWO, CONTEXT_TYPE_ONE);
        assert.equal(
            votesForContextOneAndMemeberTwo[0].toNumber(), 0);
        assert.equal(
            votesForContextOneAndMemeberTwo[1].toNumber(),
            votesInWeiForContextTypeOneAndMemberTwo);

        let votesForContextTwoAndMemeberOne =
            await reputationSystem.getVotes.call(
                projectId, MEMBER_ACCOUNT_ONE, CONTEXT_TYPE_TWO);
        assert.equal(
            votesForContextTwoAndMemeberOne[0].toNumber(), 0);
        assert.equal(
            votesForContextTwoAndMemeberOne[1].toNumber(),
            votesInWeiForContextTypeTwoAndMemberOne);

        let votesForContextTwoAndMemeberTwo =
            await reputationSystem.getVotes.call(
                projectId, MEMBER_ACCOUNT_TWO, CONTEXT_TYPE_TWO);
        assert.equal(
            votesForContextTwoAndMemeberTwo[0].toNumber(), 0);
        assert.equal(
            votesForContextTwoAndMemeberTwo[1].toNumber(),
            votesInWeiForContextTypeTwoAndMemberTwo);

        // check global reputation
        let globalReputationsSystemID =
            web3.utils.sha3(reputationSystem.address);

        let globalVotesForContextOneAndMemeberOne =
            await reputationSystem.getVotes.call(
                globalReputationsSystemID, MEMBER_ACCOUNT_ONE, CONTEXT_TYPE_ONE);
        assert.equal(
            globalVotesForContextOneAndMemeberOne[0].toNumber(), 0);
        assert.equal(
            globalVotesForContextOneAndMemeberOne[1].toNumber(),
            votesInWeiForContextTypeOneAndMemberOne);

        let globalVotesForContextOneAndMemeberTwo =
            await reputationSystem.getVotes.call(
                globalReputationsSystemID, MEMBER_ACCOUNT_TWO, CONTEXT_TYPE_ONE);
        assert.equal(
            globalVotesForContextOneAndMemeberTwo[0].toNumber(), 0);
        assert.equal(
            globalVotesForContextOneAndMemeberTwo[1].toNumber(),
            votesInWeiForContextTypeOneAndMemberTwo);

        let globalVotesForContextTwoAndMemeberOne =
            await reputationSystem.getVotes.call(
                globalReputationsSystemID, MEMBER_ACCOUNT_ONE, CONTEXT_TYPE_TWO);
        assert.equal(
            globalVotesForContextTwoAndMemeberOne[0].toNumber(), 0);
        assert.equal(
            globalVotesForContextTwoAndMemeberOne[1].toNumber(),
            votesInWeiForContextTypeTwoAndMemberOne);

        let globalVotesForContextTwoAndMemeberTwo =
            await reputationSystem.getVotes.call(
                globalReputationsSystemID, MEMBER_ACCOUNT_TWO, CONTEXT_TYPE_TWO);
        assert.equal(
            globalVotesForContextTwoAndMemeberTwo[0].toNumber(), 0);
        assert.equal(
            globalVotesForContextTwoAndMemeberTwo[1].toNumber(),
            votesInWeiForContextTypeTwoAndMemberTwo);
    });

    it("should update RepVecContext votes in a batch properly", async () => {
        let pollId = "0x09";
        let projectId = "project004";
        let currentTime = Math.floor(Date.now() / 1000);
        let votesInWeiForContextTypeOneAndMemberThree = 40;
        let votesInWeiForContextTypeOneAndMemberFour = 6;
        let votesInWeiForContextTypeTwoAndMemberThree = 2;
        let votesInWeiForContextTypeTwoAndMemberFour = 63;

        carbonVoteX = await CarbonVoteX.deployed();
        reputationSystem = await ReputationSystem.deployed();

        // gain auth from CarbonVoteX to register poll through ReputationSystem
        let register = await carbonVoteX.functionSig.call(
            web3.utils.sha3("register"));
        await carbonVoteX.permit(
            reputationSystem.address,
            carbonVoteX.address,
            register);

        // gain auth from CarbonVoteX to voteFor through ReputationSystem
        let voteFor = await carbonVoteX.functionSig.call(
            web3.utils.sha3("voteFor"));
        await carbonVoteX.permit(
            reputationSystem.address,
            carbonVoteX.address,
            voteFor);

        await reputationSystem.registerPollRequest(
            pollId,
            currentTime - 20,
            currentTime + 20,
            PSEUDO_PRICE_ONE,
            PRICE_GTE_ONE_TRUE,
            TOKEN_ADDRESS,
            {from: REGISTER_ACCOUNT});

        await reputationSystem.startPoll(
            projectId,
            pollId,
            {from: REGISTER_ACCOUNT});

        // set up upper vote limit for voters
        await carbonVoteX.writeAvailableVotes(
            pollId,
            VOTER_ACCOUNT_TWO,
            TOTAL_VOTES_LIMIT,
            {from: MASTER_ACCOUNT});

        // delegate votes
        await reputationSystem.delegate(
            projectId,
            MEMBER_ACCOUNT_THREE,
            CONTEXT_TYPE_ONE,
            pollId,
            votesInWeiForContextTypeOneAndMemberThree,
            {from: VOTER_ACCOUNT_TWO});

        await reputationSystem.delegate(
            projectId,
            MEMBER_ACCOUNT_FOUR,
            CONTEXT_TYPE_TWO,
            pollId,
            votesInWeiForContextTypeTwoAndMemberFour,
            {from: VOTER_ACCOUNT_TWO});

        await reputationSystem.delegate(
            projectId,
            MEMBER_ACCOUNT_FOUR,
            CONTEXT_TYPE_ONE,
            pollId,
            votesInWeiForContextTypeOneAndMemberFour,
            {from: VOTER_ACCOUNT_TWO});

        await reputationSystem.delegate(
            projectId,
            MEMBER_ACCOUNT_THREE,
            CONTEXT_TYPE_TWO,
            pollId,
            votesInWeiForContextTypeTwoAndMemberThree,
            {from: VOTER_ACCOUNT_TWO});


        // update RepVec Context
        await reputationSystem.batchUpdateRepVecContext(
            projectId,
            MEMBER_ACCOUNT_THREE,
            [CONTEXT_TYPE_ONE, CONTEXT_TYPE_TWO],
            true,
            false,
            {from: REGISTER_ACCOUNT});

        await reputationSystem.batchUpdateRepVecContext(
            projectId,
            MEMBER_ACCOUNT_FOUR,
            [CONTEXT_TYPE_ONE, CONTEXT_TYPE_TWO],
            true,
            false,
            {from: REGISTER_ACCOUNT});

        // check project-specific reputation
        let votesForContextOneAndMemeberThree =
            await reputationSystem.getVotes.call(
                projectId, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_ONE);
        assert.equal(
            votesForContextOneAndMemeberThree[0].toNumber(),
            votesInWeiForContextTypeOneAndMemberThree);
        assert.equal(
            votesForContextOneAndMemeberThree[1].toNumber(), 0);

        let votesForContextOneAndMemeberFour =
            await reputationSystem.getVotes.call(
                projectId, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_ONE);
        assert.equal(
            votesForContextOneAndMemeberFour[0].toNumber(),
            votesInWeiForContextTypeOneAndMemberFour);
        assert.equal(
            votesForContextOneAndMemeberFour[1].toNumber(), 0);

        let votesForContextTwoAndMemeberThree =
            await reputationSystem.getVotes.call(
                projectId, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_TWO);
        assert.equal(
            votesForContextTwoAndMemeberThree[0].toNumber(),
            votesInWeiForContextTypeTwoAndMemberThree);
        assert.equal(
            votesForContextTwoAndMemeberThree[1].toNumber(), 0);

        let votesForContextTwoAndMemeberFour =
            await reputationSystem.getVotes.call(
                projectId, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_TWO);
        assert.equal(
            votesForContextTwoAndMemeberFour[0].toNumber(),
            votesInWeiForContextTypeTwoAndMemberFour);
        assert.equal(
            votesForContextTwoAndMemeberFour[1].toNumber(), 0);

        // check global reputation
        let globalReputationsSystemID =
            web3.utils.sha3(reputationSystem.address);

        let globalVotesForContextOneAndMemeberThree =
            await reputationSystem.getVotes.call(
                globalReputationsSystemID, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_ONE);
        assert.equal(
            globalVotesForContextOneAndMemeberThree[0].toNumber(),
            votesInWeiForContextTypeOneAndMemberThree);
        assert.equal(
            globalVotesForContextOneAndMemeberThree[1].toNumber(), 0);

        let globalVotesForContextOneAndMemeberFour =
            await reputationSystem.getVotes.call(
                globalReputationsSystemID, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_ONE);
        assert.equal(
            globalVotesForContextOneAndMemeberFour[0].toNumber(),
            votesInWeiForContextTypeOneAndMemberFour);
        assert.equal(
            globalVotesForContextOneAndMemeberFour[1].toNumber(), 0);

        let globalVotesForContextTwoAndMemeberThree =
            await reputationSystem.getVotes.call(
                globalReputationsSystemID, MEMBER_ACCOUNT_THREE, CONTEXT_TYPE_TWO);
        assert.equal(
                globalVotesForContextTwoAndMemeberThree[0].toNumber(),
                votesInWeiForContextTypeTwoAndMemberThree);
        assert.equal(
                globalVotesForContextTwoAndMemeberThree[1].toNumber(), 0);

        let globalVotesForContextTwoAndMemeberFour =
            await reputationSystem.getVotes.call(
                globalReputationsSystemID, MEMBER_ACCOUNT_FOUR, CONTEXT_TYPE_TWO);
        assert.equal(
            globalVotesForContextTwoAndMemeberFour[0].toNumber(),
            votesInWeiForContextTypeTwoAndMemberFour);
        assert.equal(
            globalVotesForContextTwoAndMemeberFour[1].toNumber(), 0);
    });
});
