//! Ignored live-client smoke: create a publication with the real signing and node path.
//!
//! Run only against a healthy devnet:
//!   RPRINT_NODE=http://localhost:50403 \
//!     cargo test -p rprint-cli --test devnet_live -- --ignored --test-threads=1
#![allow(clippy::expect_used, clippy::panic, clippy::unwrap_used)]

use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use rcash_chain::node::{DeployStatus, NodeClient};
use rcash_chain::poll::PollPolicy;
use rprint_sdk::{
    article_attach_knowledge_term, article_submit_term, create_article_term,
    create_publication_term, escrow_arbitrate_term, escrow_cancel_term, escrow_dispute_term,
    escrow_expire_term, escrow_release_term, escrow_resolve_dispute_term, escrow_submit_term,
    explore_call_term, proposal_accept_term, proposal_attach_cover_term, proposal_fund_term,
    propose_commission_term,
};
use rprint_wallet::{decode_reply_json, DeploySignOptions, Wallet};
use serde_json::{json, Value};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn root_uri() -> String {
    if let Ok(root) = std::env::var("RPRINT_ROOT") {
        return root;
    }
    let manifest = fs::read_to_string(repo_root().join("deployments/devnet.json"))
        .expect("deployments/devnet.json; run make install");
    let value: serde_json::Value = serde_json::from_str(&manifest).expect("manifest JSON");
    value["root_uri"]
        .as_str()
        .expect("manifest root_uri")
        .to_string()
}

async fn wait_blocks(client: &NodeClient, start: i64, count: i64) {
    let deadline = Instant::now() + Duration::from_secs(60);
    while Instant::now() < deadline {
        let height = client.latest_block_number().await.expect("height");
        if height >= start + count {
            return;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    panic!("the devnet did not produce {count} blocks");
}

async fn submit_and_decode(client: &NodeClient, wallet: &Wallet, term: &str) -> serde_json::Value {
    let tip = client.latest_block_number().await.expect("height");
    let signed = wallet
        .sign_deploy(
            term,
            &DeploySignOptions {
                valid_after: tip,
                phlo_limit: 4_000_000,
                phlo_price: 1,
                shard: "/root".to_string(),
                timestamp_millis: None,
            },
        )
        .expect("sign");
    let body = serde_json::to_string(&signed.body).expect("body");
    match client
        .deploy_body(&body, &signed.deploy_id, term.len())
        .await
    {
        Ok(()) | Err(rcash_chain::ChainError::Duplicate { .. }) => {}
        Err(error) => panic!("deploy: {error}"),
    }
    let policy = PollPolicy::default();
    let status = client
        .wait_processed(&signed.deploy_id, policy)
        .await
        .expect("processed");
    match status {
        DeployStatus::ProcessedWithSuccess {
            deploy_result,
            block,
        } => {
            client
                .wait_finalized(&block.block_hash, policy)
                .await
                .expect("finalized");
            let first = deploy_result.first().expect("deploy result");
            let raw = serde_json::to_string(first).expect("result JSON");
            serde_json::to_value(decode_reply_json(&raw).expect("decode")).expect("value")
        }
        DeployStatus::ProcessedWithError { deploy_error, .. } => {
            panic!("deploy failed: {deploy_error}")
        }
        DeployStatus::NotProcessed { status } => panic!("not processed: {status}"),
    }
}

#[tokio::test]
#[ignore = "requires a healthy devnet and deployments/devnet.json"]
async fn creates_and_reads_a_publication_live() {
    let node = std::env::var("RPRINT_NODE").unwrap_or_else(|_| "http://localhost:40403".into());
    let client = NodeClient::new(&node).expect("node client");
    let (wallet, info) = {
        let (wallet, _document, info) = Wallet::create("cli-live-smoke").expect("wallet");
        (wallet, info)
    };

    client.faucet(&info.address).await.expect("faucet");
    let start = client.latest_block_number().await.expect("height");
    wait_blocks(&client, start, 2).await;

    let factory = {
        let term = explore_call_term(
            &root_uri(),
            "resolve",
            Some("\"component:publication-factory\", 1"),
        );
        let response = client.explore(&term).await.expect("resolve");
        let first = response.expr.first().expect("resolve value");
        let raw = serde_json::to_string(first).expect("resolve JSON");
        let reply = decode_reply_json(&raw).expect("resolve decode");
        assert!(reply.ok, "resolve refused: {:?}", reply.reason);
        reply.values[0].as_str().expect("factory URI").to_string()
    };

    let suffix = format!("{}", start);
    let publication_id = format!("pub:cli-live:{suffix}");
    let charter = json!({
        "nameHash": format!("name:{suffix}"),
        "mastheadHash": format!("mast:{suffix}"),
        "taglineHash": format!("tag:{suffix}"),
        "foundedAtHeight": 0,
        "treasuryAccountId": info.address,
        "assetId": "REV",
        "admins": [{"$bytes": info.public_key}],
        "threshold": 1,
        "arbitrators": [],
        "arbitrationThreshold": 0,
        "revenueSplit": [],
        "governance": {
            "maxMembers": 32,
            "requireFactCheck": false,
            "requireKAsset": false,
            "disputeWindowBlocks": 10,
            "commissionGraceBlocks": 5
        }
    });
    let members = json!([{
        "memberId": info.address,
        "role": "publisher",
        "did": format!("byoid:rev:{}", info.address),
        "attestationHash": format!("att:{suffix}")
    }]);
    let term = create_publication_term(
        &factory,
        &format!("create:{suffix}"),
        &publication_id,
        &charter,
        &members,
    );
    let reply = submit_and_decode(&client, &wallet, &term).await;
    assert_eq!(reply["ok"], true, "{reply}");
    let uri = reply["values"][0].as_str().expect("publication URI");

    let read = explore_call_term(uri, "info", None);
    let response = client.explore(&read).await.expect("publication info");
    let first = response.expr.first().expect("info value");
    let decoded =
        decode_reply_json(&serde_json::to_string(first).expect("json")).expect("decode info");
    assert!(decoded.ok, "info refused: {:?}", decoded.reason);
    assert_eq!(decoded.values[0]["publicationId"], publication_id);
}

fn hex32(text: &str) -> [u8; 32] {
    let bytes: Vec<u8> = (0..text.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&text[index..index + 2], 16).expect("hex"))
        .collect();
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    out
}

fn wallet_from_key(name: &str) -> (Wallet, rprint_wallet::WalletInfo) {
    let path = std::env::var("RPRINT_KEYS")
        .map(PathBuf::from)
        .unwrap_or_else(|_| repo_root().join(".devnet/keys.json"));
    let keys: Value =
        serde_json::from_str(&fs::read_to_string(&path).expect("keys file")).expect("keys JSON");
    let entry = &keys[name];
    let secret = hex32(entry["secret"].as_str().expect("secret"));
    let address = entry["address"].as_str().expect("address");
    let document = rprint_keystore::encrypt(&secret, address, "cli-live").expect("encrypt key");
    Wallet::unlock(&document, "cli-live").expect("unlock key")
}

async fn resolve(client: &NodeClient, root: &str, component: &str) -> String {
    let term = explore_call_term(root, "resolve", Some(&format!("\"{component}\", 1")));
    let response = client.explore(&term).await.expect("resolve");
    let first = response.expr.first().expect("resolve value");
    let raw = serde_json::to_string(first).expect("resolve JSON");
    let reply = decode_reply_json(&raw).expect("resolve decode");
    assert!(reply.ok, "resolve {component} refused: {:?}", reply.reason);
    reply.values[0].as_str().expect("component URI").to_string()
}

async fn read(client: &NodeClient, uri: &str, arm: &str) -> Value {
    let term = explore_call_term(uri, arm, None);
    let response = client.explore(&term).await.expect("read");
    let first = response.expr.first().expect("read value");
    let raw = serde_json::to_string(first).expect("read JSON");
    let reply = decode_reply_json(&raw).expect("read decode");
    assert!(reply.ok, "read {arm} refused: {:?}", reply.reason);
    reply.values[0].clone()
}

#[tokio::test]
#[ignore = "requires a healthy sibling devnet, make sibling-fixture and RPRINT_SIBLINGS=1"]
async fn attaches_cover_and_knowledge_live() {
    if std::env::var("RPRINT_SIBLINGS").ok().as_deref() != Some("1") {
        println!("cli-live siblings: skipped (RPRINT_SIBLINGS is not 1)");
        return;
    }
    let node = std::env::var("RPRINT_NODE").unwrap_or_else(|_| "http://localhost:40403".into());
    let client = NodeClient::new(&node).expect("node client");
    let fixture_path = std::env::var("RPRINT_SIBLING_FIXTURE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| repo_root().join("deployments/sibling-fixture.json"));
    let fixture: Value = serde_json::from_str(
        &fs::read_to_string(&fixture_path)
            .unwrap_or_else(|_| panic!("{}; run make sibling-fixture", fixture_path.display())),
    )
    .expect("fixture JSON");
    let rsure = &fixture["rsure"];
    let rgen = &fixture["rgen"];
    assert!(
        rsure.is_object() && rgen.is_object(),
        "fixture needs rsure and rgen"
    );

    let (publisher, publisher_info) = wallet_from_key("reporter1");
    let (editor, editor_info) = wallet_from_key("reporter2");
    let _ = client.faucet(&publisher_info.address).await;
    let _ = client.faucet(&editor_info.address).await;
    let start = client.latest_block_number().await.expect("height");
    wait_blocks(&client, start, 2).await;

    let root = root_uri();
    let publication_factory = resolve(&client, &root, "component:publication-factory").await;
    let commission_factory = resolve(&client, &root, "component:commission-factory").await;
    let article_factory = resolve(&client, &root, "component:article-factory").await;

    let suffix = format!("{}", start);
    let publication_id = format!("pub:cli-sibling:{suffix}");
    let charter = json!({
        "nameHash": format!("name:{suffix}"),
        "mastheadHash": format!("mast:{suffix}"),
        "taglineHash": format!("tag:{suffix}"),
        "foundedAtHeight": 0,
        "treasuryAccountId": rsure["insured"],
        "assetId": "REV",
        "admins": [{"$bytes": publisher_info.public_key}],
        "threshold": 1,
        "arbitrators": [],
        "arbitrationThreshold": 0,
        "revenueSplit": [],
        "governance": {
            "maxMembers": 32,
            "requireFactCheck": false,
            "requireKAsset": false,
            "disputeWindowBlocks": 10,
            "commissionGraceBlocks": 5
        }
    });
    let members = json!([
        {"memberId": publisher_info.address, "role": "publisher",
         "did": format!("byoid:rev:{}", publisher_info.address),
         "attestationHash": format!("att:{suffix}")},
        {"memberId": editor_info.address, "role": "editor",
         "did": format!("byoid:rev:{}", editor_info.address),
         "attestationHash": format!("att:e:{suffix}")}
    ]);
    let term = create_publication_term(
        &publication_factory,
        &format!("create:{suffix}"),
        &publication_id,
        &charter,
        &members,
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "{reply}");
    let publication_uri = reply["values"][0]
        .as_str()
        .expect("publication URI")
        .to_string();

    let proposal_id = format!("commission:cli-sibling:{suffix}");
    let proposal_data = json!({
        "publicationId": publication_id,
        "publicationUri": publication_uri,
        "writerDid": format!("byoid:rev:{}", publisher_info.address),
        "titleHash": format!("title:{suffix}"),
        "briefHash": format!("brief:{suffix}"),
        "total": 100,
        "milestones": [{"id": "m1", "kind": "draft", "amount": 100,
                        "deadlineHeight": start + 200}],
        "graceBlocks": 10,
        "disputeWindowBlocks": 10,
        "requireFactCheck": false
    });
    let term = propose_commission_term(
        &commission_factory,
        &format!("commission:{suffix}"),
        &proposal_id,
        &proposal_data,
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "{reply}");
    let proposal_uri = reply["values"][0]
        .as_str()
        .expect("proposal URI")
        .to_string();

    let term = proposal_accept_term(&proposal_uri, &format!("accept:{suffix}"));
    let reply = submit_and_decode(&client, &editor, &term).await;
    assert_eq!(reply["ok"], true, "{reply}");

    let term = proposal_attach_cover_term(
        &proposal_uri,
        &format!("cover:{suffix}"),
        rsure["policyUri"].as_str().expect("policy URI"),
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "attach cover: {reply}");
    let cover = read(&client, &proposal_uri, "coverInfo").await;
    assert_eq!(cover["coverStatus"], "active", "{cover}");
    assert_eq!(cover["coverInsured"], rsure["insured"], "{cover}");

    let article_id = format!("article:cli-sibling:{suffix}");
    let article_data = json!({
        "publicationId": publication_id,
        "publicationUri": publication_uri,
        "authors": [{"memberId": publisher_info.address,
                     "did": format!("byoid:rev:{}", publisher_info.address),
                     "bylineHash": format!("byline:{suffix}")}],
        "contentHash": rgen["contentHash"],
        "license": "cc-by-4.0",
        "customLicenseHash": "",
        "access": "open",
        "sectionHash": format!("section:{suffix}"),
        "requireFactCheck": false,
        "requireKAsset": false
    });
    let term = create_article_term(
        &article_factory,
        &format!("article:{suffix}"),
        &article_id,
        &article_data,
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "{reply}");
    let article_uri = reply["values"][0]
        .as_str()
        .expect("article URI")
        .to_string();

    let term = article_submit_term(
        &article_uri,
        &format!("submit:{suffix}"),
        rgen["contentHash"].as_str().expect("content hash"),
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "{reply}");

    let term = article_attach_knowledge_term(
        &article_uri,
        &format!("knowledge:{suffix}"),
        rgen["kassetUri"].as_str().expect("kasset"),
        rgen["claimUri"].as_str().expect("claim"),
        rgen["provenanceUri"].as_str().expect("provenance"),
        rgen["credentialUri"].as_str().expect("credential"),
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "attach knowledge: {reply}");
    let knowledge = read(&client, &article_uri, "knowledge").await;
    assert_eq!(knowledge["kassetUri"], rgen["kassetUri"], "{knowledge}");
    assert_eq!(knowledge["claimUri"], rgen["claimUri"], "{knowledge}");
    assert_eq!(
        knowledge["provenanceUri"], rgen["provenanceUri"],
        "{knowledge}"
    );
    let info = read(&client, &article_uri, "info").await;
    assert_eq!(info["contentHash"], rgen["contentHash"], "{info}");

    let term = article_attach_knowledge_term(
        &article_uri,
        &format!("knowledge-overwrite:{suffix}"),
        rgen["secondKassetUri"].as_str().expect("second kasset"),
        rgen["secondClaimUri"].as_str().expect("second claim"),
        rgen["wrongAssetProvenanceUri"]
            .as_str()
            .expect("other provenance"),
        "",
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], false, "overwrite must refuse: {reply}");
    assert_eq!(reply["reason"], "knowledge", "{reply}");

    let results = json!({
        "pass": true,
        "node": node,
        "steps": ["publication", "propose", "accept", "attach-cover", "article",
                  "submit", "attach-knowledge", "read-back", "overwrite-refusal"],
        "methods": ["proposeCommission", "acceptProposal", "attachCover",
                    "submitArticle", "attachKnowledge"],
        "publicationUri": publication_uri,
        "proposalUri": proposal_uri,
        "articleUri": article_uri
    });
    fs::create_dir_all(repo_root().join("deployments")).expect("deployments dir");
    fs::write(
        repo_root().join("deployments/cli-live-results.json"),
        serde_json::to_string_pretty(&results).expect("results JSON") + "\n",
    )
    .expect("write results");
}

/// Fund the caller's r-cash account from their native REV vault.
///
/// The pinned `rcash-sdk` deposit helper omits the account arm's `dId`, so this
/// builds the term with the deployed five-argument `account!("deposit", ...)`.
async fn fund_native_account(client: &NodeClient, wallet: &Wallet, amount: i64) {
    let config: Value = serde_json::from_str(
        &fs::read_to_string(repo_root().join("configs/devnet.json")).expect("devnet config"),
    )
    .expect("config JSON");
    let manifest: Value = serde_json::from_str(
        &fs::read_to_string(
            repo_root().join(
                config["rcash_manifest"]
                    .as_str()
                    .expect("configs/devnet.json rcash_manifest"),
            ),
        )
        .expect("rcash manifest"),
    )
    .expect("rcash manifest JSON");
    let factory = manifest["account_factory_uri"]
        .as_str()
        .expect("rcash account_factory_uri");
    let term = format!(
        r#"
new deployerId(`rho:rchain:deployerId`), deployerIdOps(`rho:rchain:deployerId:ops`),
    rl(`rho:registry:lookup`), factoryCh, accountCh, pkCh, ertpCh, issuerCh, purseCh,
    fundCh, wdCh, depCh, deployId(`rho:rchain:deployId`) in {{
  rl!(`{factory}`, *factoryCh) |
  deployerIdOps!("pubKeyBytes", *deployerId, *pkCh) |
  for (factory <- factoryCh; @pk <- pkCh) {{
    factory!("getOrCreate", pk, *accountCh) |
    for (@(true, account, ownerId) <- accountCh) {{
      rl!(`rho:rchain:ertp`, *ertpCh) | for (@(_, ERTP) <- ertpCh) {{
        @ERTP!("getRevIssuer", *issuerCh) | for (@(revBrand, issuer) <- issuerCh) {{
          @issuer!("makeEmptyPurse", *purseCh) | for (@(true, purse) <- purseCh) {{
            @purse!("revFund", *deployerId, {amount}, *fundCh) | for (@_ <- fundCh) {{
              @purse!("withdraw", (revBrand, {amount}), *wdCh) |
              for (@(true, payment) <- wdCh) {{
                @account!("deposit", *deployerId, "REV", payment, *depCh) |
                for (@d <- depCh) {{ deployId!((ownerId, d)) }}
              }}
            }}
          }}
        }}
      }}
    }}
  }}
}}
"#
    );
    let reply = submit_and_decode(client, wallet, &term).await;
    assert_eq!(reply["ok"], true, "deposit: {reply}");
}

#[allow(clippy::too_many_arguments)]
async fn create_escrow(
    client: &NodeClient,
    publisher: &Wallet,
    editor: &Wallet,
    commission_factory: &str,
    publication_id: &str,
    publication_uri: &str,
    writer_address: &str,
    suffix: &str,
    label: &str,
    total: i64,
    milestone_amount: i64,
    dispute_window: i64,
    deadline_height: i64,
    grace_blocks: i64,
) -> (String, String) {
    let proposal_id = format!("commission:{label}:{suffix}");
    let proposal_data = json!({
        "publicationId": publication_id,
        "publicationUri": publication_uri,
        "writerDid": format!("byoid:rev:{writer_address}"),
        "titleHash": format!("title:{label}:{suffix}"),
        "briefHash": format!("brief:{label}:{suffix}"),
        "total": total,
        "milestones": [{"id": "m1", "kind": "draft", "amount": milestone_amount,
                        "deadlineHeight": deadline_height}],
        "graceBlocks": grace_blocks,
        "disputeWindowBlocks": dispute_window,
        "requireFactCheck": false
    });
    let term = propose_commission_term(
        commission_factory,
        &format!("propose:{label}:{suffix}"),
        &proposal_id,
        &proposal_data,
    );
    let reply = submit_and_decode(client, publisher, &term).await;
    assert_eq!(reply["ok"], true, "propose {label}: {reply}");
    let proposal_uri = reply["values"][0]
        .as_str()
        .expect("proposal URI")
        .to_string();

    let term = proposal_accept_term(&proposal_uri, &format!("accept:{label}:{suffix}"));
    let reply = submit_and_decode(client, editor, &term).await;
    assert_eq!(reply["ok"], true, "accept {label}: {reply}");

    let term = proposal_fund_term(&proposal_uri, &format!("fund:{label}:{suffix}"));
    let reply = submit_and_decode(client, publisher, &term).await;
    assert_eq!(reply["ok"], true, "fund {label}: {reply}");
    let escrow_uri = reply["values"][0].as_str().expect("escrow URI").to_string();
    (proposal_uri, escrow_uri)
}

#[tokio::test]
#[ignore = "requires a funded devnet and deployments/devnet.json"]
async fn funds_settles_and_resolves_an_escrow_live() {
    let node = std::env::var("RPRINT_NODE").unwrap_or_else(|_| "http://localhost:40403".into());
    let client = NodeClient::new(&node).expect("node client");
    let (publisher, publisher_info) = wallet_from_key("reporter1");
    let (editor, editor_info) = wallet_from_key("reporter2");
    let _ = client.faucet(&publisher_info.address).await;
    let _ = client.faucet(&editor_info.address).await;
    fund_native_account(&client, &publisher, 1200).await;
    let start = client.latest_block_number().await.expect("height");
    wait_blocks(&client, start, 2).await;

    let root = root_uri();
    let publication_factory = resolve(&client, &root, "component:publication-factory").await;
    let commission_factory = resolve(&client, &root, "component:commission-factory").await;

    let suffix = format!("{start}");
    let publication_id = format!("pub:cli-escrow:{suffix}");
    let charter = json!({
        "nameHash": format!("name:{suffix}"),
        "mastheadHash": format!("mast:{suffix}"),
        "taglineHash": format!("tag:{suffix}"),
        "foundedAtHeight": 0,
        "treasuryAccountId": publisher_info.address,
        "assetId": "REV",
        "admins": [{"$bytes": publisher_info.public_key}],
        "threshold": 1,
        "arbitrators": [],
        "arbitrationThreshold": 0,
        "revenueSplit": [],
        "governance": {
            "maxMembers": 32,
            "requireFactCheck": false,
            "requireKAsset": false,
            "disputeWindowBlocks": 10,
            "commissionGraceBlocks": 5
        }
    });
    let members = json!([
        {"memberId": publisher_info.address, "role": "publisher",
         "did": format!("byoid:rev:{}", publisher_info.address),
         "attestationHash": format!("att:{suffix}")},
        {"memberId": editor_info.address, "role": "editor",
         "did": format!("byoid:rev:{}", editor_info.address),
         "attestationHash": format!("att:e:{suffix}")}
    ]);
    let term = create_publication_term(
        &publication_factory,
        &format!("create:{suffix}"),
        &publication_id,
        &charter,
        &members,
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "{reply}");
    let publication_uri = reply["values"][0]
        .as_str()
        .expect("publication URI")
        .to_string();

    let (_, settle) = create_escrow(
        &client,
        &publisher,
        &editor,
        &commission_factory,
        &publication_id,
        &publication_uri,
        &publisher_info.address,
        &suffix,
        "settle",
        400,
        400,
        10,
        1_000_000,
        5,
    )
    .await;
    let term = escrow_submit_term(&settle, &format!("submit:{suffix}"), "m1", "evidence:1");
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "submit: {reply}");
    let term = escrow_release_term(&settle, &format!("release:{suffix}"), "m1");
    let reply = submit_and_decode(&client, &editor, &term).await;
    assert_eq!(reply["ok"], true, "release: {reply}");
    let info = read(&client, &settle, "info").await;
    assert_eq!(info["status"], "completed", "{info}");
    assert_eq!(info["paidWriter"], 400, "{info}");
    assert_eq!(read(&client, &settle, "balance").await, json!(0));

    let (_, cancel) = create_escrow(
        &client,
        &publisher,
        &editor,
        &commission_factory,
        &publication_id,
        &publication_uri,
        &publisher_info.address,
        &suffix,
        "cancel",
        200,
        200,
        10,
        1_000_000,
        5,
    )
    .await;
    let term = escrow_cancel_term(&cancel, &format!("cancel:{suffix}"), "cancel reason");
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "cancel: {reply}");
    let info = read(&client, &cancel, "info").await;
    assert_eq!(info["status"], "cancelled", "{info}");
    assert_eq!(info["refundedFunder"], 200, "{info}");
    assert_eq!(read(&client, &cancel, "balance").await, json!(0));

    let (_, dispute) = create_escrow(
        &client,
        &publisher,
        &editor,
        &commission_factory,
        &publication_id,
        &publication_uri,
        &publisher_info.address,
        &suffix,
        "dispute",
        300,
        300,
        2,
        1_000_000,
        5,
    )
    .await;
    let term = escrow_dispute_term(&dispute, &format!("dispute:{suffix}"), "dispute reason");
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "dispute: {reply}");
    wait_blocks(&client, start, 4).await;
    let term = escrow_resolve_dispute_term(&dispute, &format!("resolve:{suffix}"));
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "resolve: {reply}");
    let info = read(&client, &dispute, "info").await;
    assert_eq!(info["status"], "expired", "{info}");
    assert_eq!(info["refundedFunder"], 300, "{info}");
    assert_eq!(read(&client, &dispute, "balance").await, json!(0));

    let deadline = client.latest_block_number().await.expect("height") + 3;
    let (_, expiring) = create_escrow(
        &client,
        &publisher,
        &editor,
        &commission_factory,
        &publication_id,
        &publication_uri,
        &publisher_info.address,
        &suffix,
        "expire",
        100,
        100,
        10,
        deadline,
        0,
    )
    .await;
    wait_blocks(&client, deadline, 1).await;
    let term = escrow_expire_term(&expiring, &format!("expire:{suffix}"));
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "expire: {reply}");
    let info = read(&client, &expiring, "info").await;
    assert_eq!(info["status"], "expired", "{info}");
    assert_eq!(info["refundedFunder"], 100, "{info}");
    assert_eq!(read(&client, &expiring, "balance").await, json!(0));

    let arbitrate_id = format!("commission:arbitrate:{suffix}");
    let (_, arbitrated) = create_escrow(
        &client,
        &publisher,
        &editor,
        &commission_factory,
        &publication_id,
        &publication_uri,
        &publisher_info.address,
        &suffix,
        "arbitrate",
        150,
        150,
        10,
        1_000_000,
        5,
    )
    .await;
    let term = escrow_dispute_term(
        &arbitrated,
        &format!("dispute-arb:{suffix}"),
        "dispute reason",
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "dispute for arbitrate: {reply}");
    // A 1-of-1 publication admin set falls back to the platform admin quorum.
    let domain = format!("commission:{arbitrate_id}");
    let (admin1, _) = wallet_from_key("admin1");
    let (admin2, _) = wallet_from_key("admin2");
    let sig1 = admin1
        .sign_admin_payload(&domain, 1, "split", &[&arbitrate_id, "5000"])
        .expect("sign arbitrate 1");
    let sig2 = admin2
        .sign_admin_payload(&domain, 1, "split", &[&arbitrate_id, "5000"])
        .expect("sign arbitrate 2");
    let term = escrow_arbitrate_term(
        &arbitrated,
        1,
        5000,
        &[sig1, sig2],
        &format!("arbitrate:{suffix}"),
    );
    let reply = submit_and_decode(&client, &publisher, &term).await;
    assert_eq!(reply["ok"], true, "arbitrate: {reply}");
    let info = read(&client, &arbitrated, "info").await;
    assert_eq!(info["status"], "arbitrated", "{info}");
    assert_eq!(info["paidWriter"], 75, "{info}");
    assert_eq!(info["refundedFunder"], 75, "{info}");
    assert_eq!(read(&client, &arbitrated, "balance").await, json!(0));

    let results = json!({
        "pass": true,
        "node": node,
        "steps": ["publication", "deposit", "propose", "accept", "fund",
                  "submit", "release", "propose-cancel", "accept-cancel", "fund-cancel",
                  "cancel", "propose-dispute", "accept-dispute", "fund-dispute",
                  "dispute", "resolve", "propose-expire", "accept-expire",
                  "fund-expire", "expire", "propose-arbitrate", "accept-arbitrate",
                  "fund-arbitrate", "dispute-arbitrate", "arbitrate"],
        "methods": ["proposeCommission", "acceptProposal", "fundProposal",
                    "submitMilestone", "releaseMilestone", "cancelEscrow",
                    "disputeEscrow", "resolveDispute", "expireEscrow",
                    "arbitrateEscrow"],
        "publicationUri": publication_uri,
        "settleEscrow": settle,
        "cancelEscrow": cancel,
        "disputeEscrow": dispute
    });
    fs::create_dir_all(repo_root().join("deployments")).expect("deployments dir");
    fs::write(
        repo_root().join("deployments/cli-live-escrow-results.json"),
        serde_json::to_string_pretty(&results).expect("results JSON") + "\n",
    )
    .expect("write escrow results");
}
