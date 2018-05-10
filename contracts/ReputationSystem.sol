pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "carbonvotex/contracts/CarbonVoteX.sol";


contract ReputationSystem {
    // events
    event PollRequestRegistered(
        address indexed requester,
        bytes32 pollId,
        uint minStartTime,
        uint maxStartTime,
        uint pseudoPrice,
        bool priceGteOne,
        address indexed tokenAddress
    );
    event PollRequestModified(
        address indexed requester,
        bytes32 pollId,
        uint minStartTime,
        uint maxStartTime,
        uint pseudoPrice,
        bool priceGteOne,
        address indexed tokenAddress
    );
    event PollStarted(address indexed requester, bytes32 id, bytes32 pollId);
    event VotesDelegated(
        address indexed requester,
        bytes32 id,
        address indexed member,
        bytes32 contextType,
        bytes32 pollId,
        uint votesInWei
    );
    event RepVecContextUpdated(
        address indexed requester,
        bytes32 id,
        address indexed member,
        bytes32 contextType,
        uint currentUpdatePollNonceStart,
        uint currentUpdatePollNonceEnd
    );
    event RepVecContextBatchUpdated(
        address indexed requester,
        bytes32 id,
        address indexed member,
        bytes32[] contextTypes
    );

    struct Context {
        bytes32 oldestPollId;
        uint oldestPollStartBlock;
        bytes32 latestPollId;
        uint latestPollEndBlock;
        uint lastUpdated;
        uint updatedTimestamp;
        uint votes;
        mapping(bytes32 => uint) pendingVotes;
        uint totalPendingVotes;
    }

    struct Reputation {
        // member address => {context type => Context}
        mapping(address => mapping(bytes32 => Context)) repVec;
    }

    struct Project {
        mapping(uint => bytes32) nonceToPollId;
        uint pollNonce;
    }

    struct PollRequest {
        uint minStartTime;
        uint maxStartTime;

        // Let price = basic unit of a Token / Wei
        // then price can possibly be a floating number, which solidity
        // does not support

        // Define pseudoPrice = price if price >= 1,
        // and set priceGteOne = true
        // otherwise pseudoPrice = 1/price, and set priceGteOne = false

        // priceGteOne == true => basic unit of a Token / Wei
        // priceGteOne == false => Wei / basic unit of a Token
        uint pseudoPrice;
        bool priceGteOne;
        address tokenAddress;
    }

    // The global reputation system's id
    bytes32 globalReputationsSystemID;

    // reputation system id => reputation struct
    mapping(bytes32 => Reputation) reputations;

    mapping(bytes32 => Project) idToProject;

    mapping(bytes32 => PollRequest) pollRequests;

    CarbonVoteX public carbon;

    // modifiers
    modifier onlyNonGlobalReputationsSystemID(bytes32 _reputationsSystemID) {
        require(
            _reputationsSystemID == globalReputationsSystemID,
            "Only Non-global Reputations System ID can be accepted."
        );
        _;
    }

    /**
    * constructor for ReputationSystem
    *
    * @param _carbonVoteX the address of a CarbonVoteX
    */
    constructor(address _carbonVoteX) public {
        carbon = CarbonVoteX(_carbonVoteX);
        globalReputationsSystemID = keccak256(address(this));
    }

    /**
    * Registers a poll request for a milestone for a project
    * Any address can then start a proxy voting with CarbonVoteX with [pollId],
    * providing the initiation time is within [minStartTime, maxStartTime]
    *
    * Only accessible to specific addresses
    *
    * Typically, this function is called by a milestone controller when a
    * project deploys milestones
    *
    * @param pollId the id of the poll to request, generated using
    *     keccak256(projectNameHash, milestoneNameHash)
    * @param minStartTime the minimum starting time (unix timestamp)
    *     to start a poll (by calling carbon.register())
    * @param maxStartTime the maximum starting time (unix timestamp)
    *     to start a poll
    * @param pseudoPrice see the definition in PollRequest
    * @param priceGteOne see the definition in PollRequest
    * @param tokenAddress the token address used for votes
    */
    function registerPollRequest(
        bytes32 pollId,
        uint minStartTime,
        uint maxStartTime,
        uint pseudoPrice,
        bool priceGteOne,
        address tokenAddress
    )
        public
    {
        require(pollRequests[pollId].minStartTime == 0 && pollRequests[pollId].maxStartTime == 0);
        pollRequests[pollId] = PollRequest({
            minStartTime: minStartTime,
            maxStartTime: maxStartTime,
            pseudoPrice: pseudoPrice,
            priceGteOne: priceGteOne,
            tokenAddress: tokenAddress
        });

        emit PollRequestRegistered(
            msg.sender,
            pollId,
            minStartTime,
            maxStartTime,
            pseudoPrice,
            priceGteOne,
            tokenAddress
        );
    }

    /**
    * Modifies a poll request for a milestone for a project
    * Any address can then start a proxy voting with CarbonVoteX with [pollId],
    * providing the initiation time is within [minStartTime, maxStartTime]
    *
    * Only accessible to specific addresses
    * Typically, this function is called by a milestone controller when
    * a milestone's starting time and/or deadline is modified

    * @param pollId the id of the poll to request, generated using
    *     keccak256(projectNameHash, milestoneNameHash)
    * @param minStartTime the minimum starting time (unix timestamp)
    *     to start a poll (by calling carbon.register())
    * @param maxStartTime the maximum starting time (unix timestamp)
    *     to start a poll
    * @param pseudoPrice see the definition in PollRequest
    * @param priceGteOne see the definition in PollRequest
    * @param tokenAddress the token address used for votes
    */
    function modifyPollRequest(
        bytes32 pollId,
        uint minStartTime,
        uint maxStartTime,
        uint pseudoPrice,
        bool priceGteOne,
        address tokenAddress
    )
        public
    {
        require(pollRequests[pollId].minStartTime != 0 && pollRequests[pollId].maxStartTime != 0);
        pollRequests[pollId] = PollRequest({
            minStartTime: minStartTime,
            maxStartTime: maxStartTime,
            pseudoPrice: pseudoPrice,
            priceGteOne: priceGteOne,
            tokenAddress: tokenAddress
        });

        emit PollRequestModified(
            msg.sender,
            pollId,
            minStartTime,
            maxStartTime,
            pseudoPrice,
            priceGteOne,
            tokenAddress
        );
    }

    /**
    * Start a poll by any address
    *
    * @param id the id of the reputation system
    *   id cannot be the global reputation system's id
    * @param pollId the id of the poll to start, generated using
    *     keccak256(projectNameHash, milestoneNameHash)
    */
    function startPoll(bytes32 id, bytes32 pollId) public onlyNonGlobalReputationsSystemID(id) {
        require(validatePollRequest(pollId));

        // 20 blocks is roughly 5 min
        // for testing only
        uint startBlock = block.number + 20;
        uint endBlock = startBlock + 20;
        carbon.register(startBlock, endBlock, pollId, pollRequests[pollId].tokenAddress);

        idToProject[id].pollNonce += 1;
        uint pollNonce = idToProject[id].pollNonce;
        idToProject[id].nonceToPollId[pollNonce] = pollId;

        emit PollStarted(msg.sender, id, pollId);
    }

    /**
    * Delegates votes to a principal in a poll, called by proxies
    *
    * @param id the id of the reputation system
    *   id cannot be the global reputation system's id
    * @param member the address of a member (regulator)
    * @param contextType the context type of the reputation vector
    * @param pollId the id of the poll, from which we delegate votes
    * @param votesInWei the number of Wei to delegate
    */
    function delegate(
        bytes32 id,
        address member,
        bytes32 contextType,
        bytes32 pollId,
        uint votesInWei
    )
        public
        onlyNonGlobalReputationsSystemID(id)
    {
        // First convert votes in wei to votes in project's token's basic unit
        uint votes = convertVotes(
            votesInWei,
            pollRequests[pollId].pseudoPrice,
            pollRequests[pollId].priceGteOne
        );

        // This basically checks if the member has enough votes
        carbon.voteFor(pollId, member, contextType, votes);

        // record voting results, here we use votes in wei as our standard unit
        // across projects

        // update project-specific reputation
        Context storage context = reputations[id].repVec[member][contextType];
        context.pendingVotes[pollId] += votesInWei;
        context.totalPendingVotes += votesInWei;

        // update global reputation
        uint startBlock;
        uint endBlock;
        (startBlock, endBlock,) = carbon.getPoll(pollId);

        Context storage globalContext = reputations[globalReputationsSystemID]
            .repVec[member][contextType];

        if(startBlock >= globalContext.oldestPollStartBlock + 100) {
            idToProject[globalReputationsSystemID].pollNonce += 1;
            globalContext.oldestPollStartBlock = startBlock;
            globalContext.oldestPollId = pollId;
        }

        if (endBlock > globalContext.latestPollEndBlock) {
            globalContext.latestPollEndBlock = endBlock;
            globalContext.latestPollId = pollId;
        }

        // add votes to the oldest poll available
        globalContext.pendingVotes[globalContext.oldestPollId] += votes;
        globalContext.totalPendingVotes += votesInWei;

        // globalNonce is always mapped to the latest pollId
        uint globalNonce = idToProject[globalReputationsSystemID].pollNonce;
        idToProject[globalReputationsSystemID]
            .nonceToPollId[globalNonce] = globalContext.latestPollId;

        emit VotesDelegated(msg.sender, id, member, contextType, pollId, votesInWei);
    }

    /**
    * Returns the numbers of effective votes and total pending votes
    *
    * @param id the id of the reputation system (either global or non-global)
    * @param member the address of a member
    * @param contextType the context type of the reputation vector
    */
    function getVotes(bytes32 id, address member, bytes32 contextType)
        public
        view
        returns (uint, uint)
    {
        uint votes = reputations[id].repVec[member][contextType].votes;
        uint totalPendingVotes = reputations[id].repVec[member][contextType].totalPendingVotes;
        return (votes, totalPendingVotes);
    }

    /**
    * Checks if a context type of a reputation vector needs update
    *
    * @param id the id of the reputation system (either global or non-global)
    * @param member the address of a member
    * @param contextType the context type of the reputation vector
    */
    function requireUpdateContext(bytes32 id, address member, bytes32 contextType)
        public
        view
        returns (bool)
    {
        Context storage context = reputations[id].repVec[member][contextType];
        return context.totalPendingVotes != 0;
    }

    /**
    * Updates a context type of a reputation vector
    *
    * Principals have to update their reputation vectors if somebody has
    *     delegated votes to them
    *
    * @param id the id of the reputation system (either global or non-global)
    * @param member the address of a member
    * @param contextType the context type of the reputation vector
    */
    function updateRepVecContext(bytes32 id, address member, bytes32 contextType) public {
        Context storage context = reputations[id].repVec[member][contextType];
        uint pollNonce = idToProject[id].pollNonce;
        uint lastUpdated = context.lastUpdated;
        if (pollNonce > 100 + lastUpdated) {
            // we only update the most recent 100 proxy votings
            // this avoids potential out-of-gas errors
            lastUpdated = pollNonce - 100;
            context.votes = 0;
            context.totalPendingVotes = 0;
        }

        // update votes from the oldest proxy voting to the latest proxy voting
        for (uint i = lastUpdated + 1; i <= pollNonce; i++) {
            bytes32 pollId = idToProject[id].nonceToPollId[i];
            if (carbon.pollExpired(pollId)) {
                uint pendingVotes = context.pendingVotes[pollId];
                context.votes = (context.votes * 9 + pendingVotes) / 10;
                context.lastUpdated = i;
                context.updatedTimestamp = now;
                if (context.totalPendingVotes >= pendingVotes) {
                    context.totalPendingVotes -= pendingVotes;
                }
                context.pendingVotes[pollId] = 0;
              }
        }

        emit RepVecContextUpdated(msg.sender, id, member, contextType, lastUpdated + 1, pollNonce);
    }


    /**
    * Updates reputation vectors for a batch of context types
    *
    * Principals have to update their reputation vectors if somebody has
    *     delegated votes to them
    *
    * @param id the id of the reputation system (either global or non-global)
    * @param member the address of a member
    * @param contextTypes the context type of the reputation vector
    * @param enableGlobalUpdate enable updates for global reputation vectors
    */
    function batchUpdateRepVecContext(
        bytes32 id,
        address member,
        bytes32[] contextTypes,
        bool enableGlobalUpdate
    )
        public
    {
        for (uint i = 0; i < contextTypes.length; i++) {
            updateRepVecContext(id, member, contextTypes[i]);
            if (enableGlobalUpdate) {
                updateRepVecContext(globalReputationsSystemID, member, contextTypes[i]);
            }
        }

        emit RepVecContextBatchUpdated(msg.sender, id, member, contextTypes);
    }

    /**
    * Returns votes in project's token's basic unit
    *
    * The convention rule:
    *     Let price = basic unit of a Token / Wei
    *     then price can possibly be a floating number, which solidity does not support
    *
    *     Define pseudoPrice = price if price >= 1, and set priceGteOne = true
    *     otherwise pseudoPrice = 1/price, and set priceGteOne = false
    *
    * @param votesInWei the number of Wei to delegate
    * @param pseudoPrice see the definition in the convention rule
    * @param priceGteOne see the definition in the convention rule
    */
    function convertVotes(uint votesInWei, uint pseudoPrice, bool priceGteOne)
        private
        pure
        returns (uint)
    {
        if (priceGteOne)
            return votesInWei * pseudoPrice;
        else {
            return votesInWei / pseudoPrice;
        }
    }

    /**
    * Before starting a poll, we verify the current time complies with the info
    * provided in the corresponding poll request
    *
    * @param pollId the id of the poll to validate, generated using
    *     keccak256(projectNameHash, milestoneNameHash)
    */
    function validatePollRequest(bytes32 pollId) private view returns (bool) {
        // note that if pollId does not exist in pollRequests =>
        //     maxStartTime < now => no need to if pollId exists
        return pollRequests[pollId].minStartTime <= now && now < pollRequests[pollId].maxStartTime;
    }
}
