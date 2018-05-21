pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "carbonvotex/contracts/CarbonVoteXCore.sol";
import "carbonvotex/contracts/ICarbonVoteXReceiver.sol";


contract ReputationSystem is ICarbonVoteXReceiver {
    // events
    event PollRequestRegistered(
        address indexed requester,
        bytes32 pollId,
        uint minStartTime,
        uint maxStartTime,
        uint pseudoPrice,
        bool priceGteOne,
        address indexed tokenAddress,
        bytes32[] contextTypes
    );

    event PollRequestModified(
        address indexed requester,
        bytes32 pollId,
        uint minStartTime,
        uint maxStartTime,
        uint pseudoPrice,
        bool priceGteOne,
        address indexed tokenAddress,
        bytes32[] contextTypes
    );

    event PollStarted(address indexed requester, bytes32 id, bytes32 pollId);

    event Voted(
        address indexed requester,
        bytes32 id,
        address indexed member,
        bytes32 contextType,
        bytes32 pollId,
        uint votesInWei,
        uint globalNonce
    );

    event RepVecContextUpdated(
        address indexed requester,
        bytes32 id,
        address indexed member,
        bytes32 contextType,
        uint currentUpdatePollNonceStart,
        uint currentUpdatePollNonceEnd
    );

    event GlobalRepVecContextUpdated(
        address indexed requester,
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
        uint pollNonce;
        bytes32 oldestPollId;
        uint oldestPollStartBlock;
        bytes32 latestPollId;
        uint latestPollEndBlock;
        mapping(uint => bytes32) nonceToLatestPollId;
        mapping(uint => bytes32) nonceToOldestPollId;
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
        bytes32[] contextTypes;
    }

    struct Poll {
        // the assigned votes for voter
        uint totalVotes;

        // voter address => (contextType => votes)
        // choice can be hashed value of voting options
        // e.g. sha3("choice #1"), sha3("choice #2")
        mapping (address => mapping(bytes32 => uint)) votesForContextType;

        // choice => votes
        mapping (bytes32 => uint) totalVotesForContextType;

        // voter address => (context type => available votes));
        mapping (address => mapping(bytes32 => uint)) availableVotesForContextType;
    }


    // The global reputation system's id
    bytes32 globalReputationsSystemID;

    // reputation system id => reputation struct
    mapping(bytes32 => Reputation) reputations;

    mapping(bytes32 => Project) public idToProject;

    mapping(bytes32 => PollRequest) public pollRequests;

    // pollId => Poll struct
    mapping (bytes32 => Poll) polls;

    CarbonVoteXCore public carbonVoteXCore;

    bytes32 public namespace;


    // modifiers
    modifier onlyNonGlobalReputationsSystemID(bytes32 _reputationsSystemID) {
        require(
            _reputationsSystemID != globalReputationsSystemID,
            "Only Non-global Reputations System ID can be accepted."
        );
        _;
    }

    /**
    * constructor for ReputationSystem
    *
    # @param _namespace the namespace of this CarbonVoteX receiver
    * @param _carbonVoteXCore the address of a carbonVoteXCore
    */
    constructor(bytes32 _namespace, address _carbonVoteXCore) public {
        namespace = _namespace;
        carbonVoteXCore = CarbonVoteXCore(_carbonVoteXCore);
        globalReputationsSystemID = keccak256(address(this));
    }

    /**
     * Gets the amount of gas remaining for voter
     *
     * @param pollId UUID (hash value) of a poll
     * @param voter address of a voter
     */
    function getGasSent(bytes32 pollId, address voter) external view returns (uint) {
        return carbonVoteXCore.getGasSent(namespace, pollId, voter);
    }

    /**
    * Gets votes of context type available for a voter.
    *
    * @param pollId UUID (hash value) of a poll
    * @param voter address of a voter
    * @param contextType contextType the context type the voter voted for
    */
    function readAvailableVotesForContextType(bytes32 pollId, address voter, bytes32 contextType)
        external
        view
        returns (uint)
    {
        require(pollExist(pollId));
        return polls[pollId].availableVotesForContextType[voter][contextType];
    }

    /**
    * Set votes available to voter.
    * Voters have the same number of votes for each reputation context.
    * It only can be called by master address of carbonVoteXCore
    *
    * @param pollId UUID (hash value) of a poll
    * @param voter address of a voter
    * @param votes number of votes to write
    */
    function writeAvailableVotes(bytes32 pollId, address voter, uint votes) external {
        require (msg.sender == address(carbonVoteXCore));

        polls[pollId].totalVotes = votes;
        bytes32[] storage contextTypes = pollRequests[pollId].contextTypes;
        for (uint i = 0; i < contextTypes.length; i++){
            polls[pollId].availableVotesForContextType[voter][contextTypes[i]] = votes;
        }
    }

    /**
    * Returns whether a voter has already obtained votes.
    *
    * @param pollId UUID (hash value) of a poll
    * @param voter address of a voter
    */
    function voteObtained(bytes32 pollId, address voter) external view returns (bool) {
        return carbonVoteXCore.voteObtained(namespace, pollId, voter);
    }

    /**
    * Returns the numbers of effective votes and total pending votes for members
    *
    * @param id the id of the reputation system (either global or non-global)
    * @param member the address of a member
    * @param contextType the context type of the reputation vector
    */
    function getVotesForMember(bytes32 id, address member, bytes32 contextType)
        external
        view
        returns (uint, uint)
    {
        uint votes = reputations[id].repVec[member][contextType].votes;
        uint totalPendingVotes = reputations[id].repVec[member][contextType].totalPendingVotes;
        return (votes, totalPendingVotes);
    }

    /**
    * Returns the voting result for context type.
    * It is typically called by other contracts
    *
    * @param pollId the id of the poll to request, generated using
    *     keccak256(projectNameHash, milestoneNameHash)
    * @param contextType the context type the voter voted for
    */
    function getVotingResultForContextType(
        bytes32 pollId,
        bytes32 contextType
    )
        external
        view
        returns (uint)
    {
        //Check if poll exists
        require(pollExist(pollId));

        return polls[pollId].totalVotesForContextType[contextType];
    }


    /**
    * Returns the voting result for context type by a voter.
    * It is typically called by other contracts
    *
    * @param pollId the id of the poll to request, generated using
    *     keccak256(projectNameHash, milestoneNameHash)
    * @param voter the address of a voter
    * @param contextType the context type the voter voted for
    */
    function getVotingResultForContextTypeByVoter(
        bytes32 pollId,
        address voter,
        bytes32 contextType
    )
        external
        view
        returns (uint)
    {
        //Check if poll exists
        require(pollExist(pollId));

        return polls[pollId].votesForContextType[voter][contextType];
    }

    /**
    * Registers a poll request for a milestone for a project
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
    * @param contextTypes the context types used for votes
    */
    function registerPollRequest(
        bytes32 pollId,
        uint minStartTime,
        uint maxStartTime,
        uint pseudoPrice,
        bool priceGteOne,
        address tokenAddress,
        bytes32[] contextTypes
    )
        public
    {
        require(
            pollRequests[pollId].minStartTime == 0 &&
            pollRequests[pollId].maxStartTime == 0,
            "can not register twice"
        );
        pollRequests[pollId] = PollRequest({
            minStartTime: minStartTime,
            maxStartTime: maxStartTime,
            pseudoPrice: pseudoPrice,
            priceGteOne: priceGteOne,
            tokenAddress: tokenAddress,
            contextTypes: contextTypes
        });

        emit PollRequestRegistered(
            msg.sender,
            pollId,
            minStartTime,
            maxStartTime,
            pseudoPrice,
            priceGteOne,
            tokenAddress,
            contextTypes
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
    * @param contextTypes the context types used for votes
    */
    function modifyPollRequest(
        bytes32 pollId,
        uint minStartTime,
        uint maxStartTime,
        uint pseudoPrice,
        bool priceGteOne,
        address tokenAddress,
        bytes32[] contextTypes
    )
        public
    {
        require(
            pollRequests[pollId].minStartTime != 0 &&
            pollRequests[pollId].maxStartTime != 0,
            "poll has to be registered before modification");
        pollRequests[pollId] = PollRequest({
            minStartTime: minStartTime,
            maxStartTime: maxStartTime,
            pseudoPrice: pseudoPrice,
            priceGteOne: priceGteOne,
            tokenAddress: tokenAddress,
            contextTypes: contextTypes
        });

        emit PollRequestModified(
            msg.sender,
            pollId,
            minStartTime,
            maxStartTime,
            pseudoPrice,
            priceGteOne,
            tokenAddress,
            contextTypes
        );
    }

    /**
    * Start a poll by any address.
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
        carbonVoteXCore.register(
            namespace,
            startBlock,
            endBlock,
            pollId,
            pollRequests[pollId].tokenAddress);

        idToProject[id].pollNonce += 1;
        uint pollNonce = idToProject[id].pollNonce;
        idToProject[id].nonceToLatestPollId[pollNonce] = pollId;
        idToProject[id].nonceToOldestPollId[pollNonce] = pollId;

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
    function vote(
        bytes32 id,
        address member,
        bytes32 contextType,
        bytes32 pollId,
        uint votesInWei
    )
        public
        onlyNonGlobalReputationsSystemID(id)
    {
        // poll must exits and not yet expired.
        require(pollExist(pollId) && !pollExpired(pollId));

        // convert votes in wei to votes in project's token's basic unit
        uint votes = convertVotes(
            votesInWei,
            pollRequests[pollId].pseudoPrice,
            pollRequests[pollId].priceGteOne
        );

        // voter cannot vote more votes than it has for contextType.
        require(
            polls[pollId].availableVotesForContextType[msg.sender][contextType] >= votes
        );

        // deduct voter's available votes from.
        polls[pollId].availableVotesForContextType[msg.sender][contextType] -= votes;

        // place votes to voter's choice for contextType.
        polls[pollId].votesForContextType[msg.sender][contextType] += votes;

        // place votes to totalVotesByChoice;
        polls[pollId].totalVotesForContextType[contextType] += votes;


        // record voting results, here we use votes in wei as our standard unit
        // across projects

        // update project-specific reputation
        Context storage context = reputations[id].repVec[member][contextType];
        context.pendingVotes[pollId] += votesInWei;
        context.totalPendingVotes += votesInWei;

        // update global reputation
        uint startBlock;
        uint endBlock;
        (startBlock, endBlock,) = getPoll(pollId);

        Context storage globalContext = reputations[globalReputationsSystemID]
            .repVec[member][contextType];

        if((idToProject[globalReputationsSystemID].pollNonce == 0) ||
            startBlock >= idToProject[globalReputationsSystemID].oldestPollStartBlock + 100) {
            idToProject[globalReputationsSystemID].oldestPollStartBlock = startBlock;
            idToProject[globalReputationsSystemID].oldestPollId = pollId;
            idToProject[globalReputationsSystemID].pollNonce += 1;

        }

        if (endBlock > idToProject[globalReputationsSystemID].latestPollEndBlock) {
            idToProject[globalReputationsSystemID].latestPollEndBlock = endBlock;
            idToProject[globalReputationsSystemID].latestPollId = pollId;
        }

        // add votes to the oldest poll available
        globalContext
            .pendingVotes[idToProject[globalReputationsSystemID].oldestPollId] += votesInWei;
        globalContext.totalPendingVotes += votesInWei;


        idToProject[globalReputationsSystemID]
            .nonceToLatestPollId[idToProject[globalReputationsSystemID].pollNonce] =
                idToProject[globalReputationsSystemID].latestPollId;

        idToProject[globalReputationsSystemID]
            .nonceToOldestPollId[idToProject[globalReputationsSystemID].pollNonce] =
                idToProject[globalReputationsSystemID].oldestPollId;


        emit Voted(
            msg.sender,
            id,
            member,
            contextType,
            pollId,
            votesInWei,
            idToProject[globalReputationsSystemID].pollNonce
        );
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
    * @param expirationCheck whether to check poll expires
    */
    function updateRepVecContext(
        bytes32 id,
        address member,
        bytes32 contextType,
        bool expirationCheck
    )
        public
    {
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
            bytes32 latestPollId = idToProject[id].nonceToLatestPollId[i];
            bytes32 oldestPollId = idToProject[id].nonceToOldestPollId[i];
            if ((!expirationCheck) || (expirationCheck && pollExpired(latestPollId))) {
                uint pendingVotes = context.pendingVotes[oldestPollId];
                if (pollNonce == 1) {
                    context.votes =  pendingVotes;
                } else {
                    context.votes = (context.votes * 9 + pendingVotes)/10;
                }

                context.lastUpdated = i;
                context.updatedTimestamp = now;
                if (context.totalPendingVotes >= pendingVotes) {
                    context.totalPendingVotes -= pendingVotes;
                }
                context.pendingVotes[oldestPollId] = 0;
            }
        }

        if (id == globalReputationsSystemID) {
            emit GlobalRepVecContextUpdated(
                msg.sender,
                member,
                contextType,
                lastUpdated + 1,
                pollNonce
            );
        } else {
            emit RepVecContextUpdated(
                msg.sender,
                id,
                member,
                contextType,
                lastUpdated + 1,
                pollNonce
            );
        }
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
    * @param expirationCheck whether to check poll expires
    */
    function batchUpdateRepVecContext(
        bytes32 id,
        address member,
        bytes32[] contextTypes,
        bool enableGlobalUpdate,
        bool expirationCheck
    )
        public
    {
        for (uint i = 0; i < contextTypes.length; i++) {
            updateRepVecContext(id, member, contextTypes[i], expirationCheck);
            if (enableGlobalUpdate) {
                updateRepVecContext(
                    globalReputationsSystemID,
                    member,
                    contextTypes[i],
                    expirationCheck
                );
            }
        }

        emit RepVecContextBatchUpdated(msg.sender, id, member, contextTypes);
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
    * Checks if a poll exits
    *
    * @param pollId the id of the poll to start, generated using
    *     keccak256(projectNameHash, milestoneNameHash)
    */
    function pollExist(bytes32 pollId) public view returns (bool) {
        return carbonVoteXCore.pollExist(namespace, pollId);
    }

    /**
    * Checks if a poll has expired
    *
    * @param pollId the id of the poll to start, generated using
    *     keccak256(projectNameHash, milestoneNameHash)
    */
    function pollExpired(bytes32 pollId) public view returns (bool) {
        // Check if poll exists
        require(pollExist(pollId));

        return carbonVoteXCore.pollExpired(namespace, pollId);
    }

    /**
    * Returns the namespace of this CarbonVoteReceiver.
    */
    function getNamespace() external view returns (bytes32){
        return namespace;
    }

    /**
     * Gets the startBlock, endBlock, pollId and token address of the poll.
     *
     * @param pollId UUID (hash value) of a poll
     */
    function getPoll(bytes32 pollId) public view returns (uint, uint, bytes32, address) {
        return carbonVoteXCore.getPoll(namespace, pollId);
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
