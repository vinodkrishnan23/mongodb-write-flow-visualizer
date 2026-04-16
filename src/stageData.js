const stages = [
  {
    id: 'bson_serialize',
    icon: '💻',
    title: 'BSON Serialization & Server Selection',
    subtitle: 'Driver encodes OP_MSG and targets Primary',
    category: 'network',
    description:
      'The MongoDB driver serializes the document into BSON, wraps it in an OP_MSG frame (opcode 2013), and routes writes to the replica set primary. With w:0, the client returns immediately after write dispatch (before server execution).',
    codeSnippet: `BSONObjBuilder bob;
bob.append("insert", nss.coll());
OpMsgRequest request = OpMsgRequestBuilder::create(
    auth::ValidatedTenancyScope::kNotRequired, dbName, bob.obj());
auto swHost = topology->selectServer(ReadPreference::PrimaryOnly);
transport::Session::write(request.serialize());`,
    keyFacts: [
      'OP_MSG is the modern wire protocol path for commands.',
      'Primary-only routing is mandatory for replica set writes.',
      'w:0 is acknowledged client-side before the server executes the write.',
      'BSON serialization happens in application process memory.',
      'Network retryability depends on driver/session settings, not write concern alone.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: { w0: true }
  },
  {
    id: 'tcp_wire',
    icon: '🌐',
    title: 'TCP Wire Transmission',
    subtitle: 'Kernel send/receive buffers move bytes',
    category: 'network',
    description:
      'Bytes move from the client kernel send buffer across the network into the mongod kernel receive buffer before user-space processing begins.',
    codeSnippet: `ssize_t n = ::send(clientFd, opMsgBuf, len, MSG_NOSIGNAL);
// ... network transit ...
ssize_t r = ::recv(serverFd, recvBuf, sizeof(recvBuf), 0);
if (r > 0) {
  ingressSession->consume(recvBuf, r);
}`,
    keyFacts: [
      'This stage is pure network I/O; no BSON mutation occurs.',
      'TCP acknowledgement is not MongoDB write acknowledgement.',
      'Packet retransmission is handled by TCP stack automatically.',
      'Latency and congestion directly impact end-to-end write response times.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  },
  {
    id: 'server_network',
    icon: '🖥️',
    title: 'Server Network Layer',
    subtitle: 'Ingress parses bytes into Message',
    category: 'ram',
    description:
      'SessionWorkflow reads network bytes, materializes a heap Message object, and forwards the request to ServiceEntryPointShardRole::handleRequest().',
    codeSnippet: `StatusWith<Message> swMsg = sessionWorkflow->sourceMessage();
Message inMessage = std::move(swMsg.getValue());
auto response = ServiceEntryPointShardRole::handleRequest(
    opCtx.get(), inMessage, session);
session->sinkMessage(response);`,
    keyFacts: [
      'Message parsing is done in mongod process memory.',
      'Ingress admission control may throttle requests before execution.',
      'No storage engine transaction has started yet.',
      'Malformed messages are rejected before command dispatch.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  },
  {
    id: 'command_dispatch',
    icon: '⚙️',
    title: 'Command Dispatch & OperationContext',
    subtitle: 'CommandRegistry lookup and opCtx setup',
    category: 'logic',
    description:
      'MongoDB resolves the command in CommandRegistry, creates OperationContext, and attaches WriteConcernOptions used later for awaitReplication behavior.',
    codeSnippet: `auto opCtx = cc().makeOperationContext();
auto invocation = CommandHelpers::findCommand(opMsg.body);
WriteConcernOptions wc =
    repl::extractWriteConcern(opCtx.get(), opMsg.body, defaultWC);
opCtx->setWriteConcern(wc);
invocation->run(opCtx.get(), request);`,
    keyFacts: [
      'WriteConcernOptions are bound to OperationContext for the command lifetime.',
      'Authorization and command parsing occur before write execution.',
      'Dispatch is CPU/logic bound and independent of disk latency.',
      'Retryable-write metadata is also evaluated in this layer.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  },
  {
    id: 'lock_acquisition',
    icon: '🔒',
    title: 'Hierarchical Lock Acquisition',
    subtitle: 'Global IX → DB IX → Collection IX',
    category: 'logic',
    description:
      'The write path acquires intent locks in hierarchy order: Global IX, Database IX, and Collection IX, coordinating concurrency in-process.',
    codeSnippet: `Lock::GlobalLock globalLock(opCtx, MODE_IX);
AutoGetDb autoDb(opCtx, dbName, MODE_IX);
Lock::DBLock dbLock(opCtx, dbName, MODE_IX);
AutoGetCollection coll(opCtx, nss, MODE_IX);
CollectionWriter writer(opCtx, nss);`,
    keyFacts: [
      'IX locks allow concurrent writes with fine-grained conflict resolution.',
      'Lock ordering prevents deadlocks across resources.',
      'Locks are held through transactional write execution.',
      'Contention here can dominate latency during heavy concurrency.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  },
  {
    id: 'wt_txn_open',
    icon: '🏔️',
    title: 'WiredTiger Transaction Opens',
    subtitle: 'Snapshot transaction starts (MVCC)',
    category: 'ram',
    description:
      'The storage engine opens a WiredTiger transaction with snapshot isolation, allocating MVCC state for the write unit of work.',
    codeSnippet: `WriteUnitOfWork wuow(opCtx);
auto& ru = *shard_role_details::getRecoveryUnit(opCtx);
ru.getSession()->begin_transaction("isolation=snapshot");
Timestamp readTs = ru.getPointInTimeReadTimestamp();`,
    keyFacts: [
      'Snapshot isolation gives a consistent MVCC view.',
      'Transaction state is maintained in memory until commit/abort.',
      'WriteUnitOfWork scopes atomicity at MongoDB layer.',
      'No journal fsync has occurred at this point.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  },
  {
    id: 'doc_write_cache',
    icon: '📄',
    title: 'Document Written to Block Cache',
    subtitle: 'Dirty B-Tree page in WT cache',
    category: 'ram',
    description:
      'WiredTigerRecordStore::_insertRecords() updates B-Tree pages in the block cache, marking them dirty in RAM pending journal/checkpoint persistence.',
    codeSnippet: `Status WiredTigerRecordStore::_insertRecords(OperationContext* opCtx,
    std::vector<Record>* records, const std::vector<Timestamp>& ts) {
  auto cursor = _uriTable->getCursor(opCtx);
  int ret = wiredTigerCursorInsert(cursor.get(), records);
  invariantWTOK(ret, opCtx);
  return Status::OK();
}`,
    keyFacts: [
      'Primary data mutation lands in memory-backed block cache first.',
      'Dirty cache pages are not immediately written to .wt data files.',
      'This is where document bytes become visible to in-memory readers.',
      'Checkpointing later flushes these pages to data files.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  },
  {
    id: 'oplog_write',
    icon: '📝',
    title: 'Oplog Entry Written (Same Transaction)',
    subtitle: 'OpObserver writes local.oplog.rs atomically',
    category: 'ram',
    description:
      'OpObserverImpl::onInserts() writes oplog entries into local.oplog.rs inside the same WiredTiger transaction as the user document write, preserving atomicity.',
    codeSnippet: `void OpObserverImpl::onInserts(OperationContext* opCtx,
    const NamespaceString& nss, std::vector<InsertStatement>::const_iterator first,
    std::vector<InsertStatement>::const_iterator last, bool fromMigrate) {
  repl::MutableOplogEntry entry;
  repl::logInsertOps(opCtx, nss, first, last, &entry);
  writeToOplog(opCtx, &entry);  // same RecoveryUnit / WT txn
}`,
    keyFacts: [
      'Collection write + oplog write share one WT transaction.',
      'Atomicity prevents oplog/document divergence on rollback of txn.',
      'Replication consumers rely on this oplog entry sequence.',
      'Oplog entry exists in memory before visibility advancement.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  },
  {
    id: 'wt_commit',
    icon: '✅',
    title: 'WiredTiger Transaction Commits',
    subtitle: 'WAL record placed in in-memory log buffer',
    category: 'ram',
    description:
      'WT_SESSION::commit_transaction() finalizes the write unit. Log records enter the in-memory WiredTiger WAL buffer and MongoDB releases locks.',
    codeSnippet: `wuow.commit();
int ret = session->commit_transaction(nullptr);
invariantWTOK(ret, opCtx);
locker->endWriteUnitOfWork();
// WT log record now durable-in-memory, not yet fsync'ed to disk`,
    keyFacts: [
      'WT commit completes before journal flush.',
      'All write concerns pass through this in-memory commit point.',
      'Locks are released after successful commit.',
      'Crash before journal flush may lose this committed-in-memory state.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  },
  {
    id: 'journal_flush',
    icon: '💾',
    title: 'Journal Flush to Disk',
    subtitle: 'log_flush(sync=on) and fdatasync()',
    category: 'disk',
    description:
      'For w:1 and w:majority (default replica set behavior with writeConcernMajorityShouldJournal=true), MongoDB waits for journal flush to disk before ACK from primary.',
    codeSnippet: `if (writeConcernMajorityShouldJournal || wc.syncMode == WriteConcernOptions::SyncMode::JOURNAL) {
  int ret = _logManager.log_flush("sync=on");
  invariantWTOK(ret, opCtx);
  ::fdatasync(journalFd);
}`,
    keyFacts: [
      'This stage is required for w:1 ACK in default replica set configs.',
      'Flush persists WT journal bytes to storage media.',
      'It is disk-bound and sensitive to IOPS/latency.',
      'w:0 does not wait here before client returns.'
    ],
    applicableTo: ['w1', 'wmajority'],
    isAckPoint: { w1: true }
  },
  {
    id: 'oplog_visibility',
    icon: '👁️',
    title: 'Oplog Visibility Advances',
    subtitle: 'all_durable updates oplogReadTimestamp',
    category: 'ram',
    description:
      'MongoDB advances in-memory visibility when there are no oplog holes, updating oplogReadTimestamp from all_durable so secondaries can safely read contiguous history.',
    codeSnippet: `Timestamp allDurable = storageEngine->getAllDurableTimestamp();
if (allDurable > replCoord->getOplogReadTimestamp()) {
  replCoord->setOplogReadTimestamp(allDurable);
  oplogVisibilityManager->setOplogReadTimestamp(allDurable);
  _oplogWaiterList.notify_all();
}`,
    keyFacts: [
      'all_durable is an in-memory visibility concept, not a disk guarantee.',
      'Visibility does not move past holes in commit order.',
      'Tailable cursors awaken when oplogReadTimestamp advances.',
      'Majority replication waits depend on this contiguous visibility state.'
    ],
    applicableTo: ['wmajority'],
    isAckPoint: {}
  },
  {
    id: 'secondary_fetch',
    icon: '📡',
    title: "Secondary Reads Oplog from Primary's RAM",
    subtitle: 'Tailable exhaust cursor reads block cache',
    category: 'network',
    description:
      "Secondary fetchers read oplog entries from the primary's visible oplog (backed by primary block cache/RAM), gated by oplogReadTimestamp and all_durable.",
    codeSnippet: `auto cursor = DBClientCursor::fromAggregationRequest(
    conn.get(), NamespaceString::kRsOplogNamespace, query, options);
while (cursor->moreInCurrentBatch()) {
  BSONObj doc = cursor->nextSafe();
  enqueueDocuments(std::move(doc));
}
// source is primary visible oplog in cache, not primary disk files`,
    keyFacts: [
      "Secondaries stream from primary's visible oplog in RAM.",
      'Fetch is blocked until primary advances oplogReadTimestamp.',
      'Network transfer uses tailable/exhaust style replication cursor.',
      'Primary disk checkpoint timing does not gate secondary fetch.'
    ],
    applicableTo: ['wmajority'],
    isAckPoint: {}
  },
  {
    id: 'secondary_apply',
    icon: '🔄',
    title: 'Secondary Applies & Journals',
    subtitle: 'Apply batch, journal, send progress',
    category: 'disk',
    description:
      'Secondaries apply oplog entries into their own WiredTiger tables, journal to local disk, then send replSetUpdatePosition progress back to primary.',
    codeSnippet: `Status SyncTail::_applyOplogBatch(OperationContext* opCtx, const OpQueue& ops) {
  writeConflictRetry(opCtx, "replBatch", NamespaceString::kRsOplogNamespace, [&] {
    applyOps(opCtx, ops);
    storageEngine->waitUntilDurable(opCtx);
  });
  replCoord->processReplSetUpdatePosition(updatePositionCmd);
  return Status::OK();
}`,
    keyFacts: [
      'Each secondary durably journals the replicated operation locally.',
      'Apply path includes its own WT transaction and journal flush.',
      'Progress is reported via replSetUpdatePosition messages.',
      'Majority acknowledgement depends on enough secondaries completing this.'
    ],
    applicableTo: ['wmajority'],
    isAckPoint: {}
  },
  {
    id: 'majority_ack',
    icon: '🎯',
    title: 'Majority Commit Point Advances → ACK',
    subtitle: 'awaitReplication() returns OK',
    category: 'logic',
    description:
      'ReplicationCoordinatorImpl advances _currentCommittedSnapshot after majority durability criteria are met; awaitReplication() then returns and client receives ACK.',
    codeSnippet: `auto statusAndDur = replCoord->awaitReplication(opCtx, opTime, wc);
if (statusAndDur.status.isOK()) {
  replCoord->_setCurrentCommittedSnapshot_inlock(committedSnapshot);
  return Status::OK();
}
return statusAndDur.status;`,
    keyFacts: [
      'This is the decisive ACK point for w:"majority".',
      'Requires majority of voting nodes to report durable progress.',
      'Commit point is a replication logic milestone, not checkpoint completion.',
      'Provides strongest crash survivability semantics among these options.'
    ],
    applicableTo: ['wmajority'],
    isAckPoint: { wmajority: true }
  },
  {
    id: 'checkpoint',
    icon: '🗄️',
    title: 'WiredTiger Checkpoint (Background ~60s)',
    subtitle: 'Dirty cache pages flushed to .wt files',
    category: 'disk',
    description:
      'A background checkpoint thread periodically writes dirty pages from cache to .wt data files (roughly every 60 seconds), independent from write concern ACK timing.',
    codeSnippet: `void CheckpointThread::run() {
  while (!globalInShutdownDeprecated()) {
    sleepsecs(storageGlobalParams.syncdelay); // ~60s default
    auto session = wtConn->open_session();
    session->checkpoint(session, "use_timestamp=true");
  }
}`,
    keyFacts: [
      'Checkpoint is asynchronous background storage housekeeping.',
      'Write concern ACKs do not wait for data file checkpoint.',
      'Flushes dirty cache pages into .wt files on disk.',
      'Crash recovery still replays journal regardless of checkpoint cadence.'
    ],
    applicableTo: ['w0', 'w1', 'wmajority'],
    isAckPoint: {}
  }
];

export default stages;
