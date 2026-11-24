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
    create_publication_term, explore_call_term, proposal_accept_term, proposal_attach_cover_term,
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
