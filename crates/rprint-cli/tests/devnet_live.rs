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
use rprint_sdk::{create_publication_term, explore_call_term};
use rprint_wallet::{decode_reply_json, DeploySignOptions, Wallet};
use serde_json::json;

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
