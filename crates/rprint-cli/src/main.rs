//! The `rprint` command-line client.
//!
//! Dry-run commands print the canonical Rholang term. `read` and `submit` talk to a real
//! node through the pinned r-cash chain client; signing and keystore handling come from
//! `rprint-wallet`, so the CLI and the browser share one implementation.

use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use rcash_chain::node::{DeployStatus, NodeClient};
use rcash_chain::poll::PollPolicy;
use rcash_chain::ChainError;
use rprint_sdk as sdk;
use rprint_wallet::{decode_reply_json, DeploySignOptions, Wallet};
use serde_json::Value;

type CliResult<T> = Result<T, String>;

#[derive(Parser)]
#[command(name = "rprint", version = rprint_core::VERSION)]
struct Cli {
    /// Node HTTP endpoint. Dry-run commands ignore it.
    #[arg(
        long,
        global = true,
        env = "RPRINT_NODE",
        default_value = "http://localhost:40403"
    )]
    node: String,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Print the protocol version.
    Version,
    /// Build a signed-deploy registry call term.
    Call {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        binding: String,
        #[arg(long, default_value = "")]
        args: String,
    },
    /// Build the signed admin payload text.
    AdminPayload {
        #[arg(long)]
        domain: String,
        #[arg(long)]
        nonce: u64,
        #[arg(long)]
        action: String,
        #[arg(long, value_delimiter = ',', default_value = "")]
        args: Vec<String>,
    },
    /// Read an arm with explore-deploy.
    Read {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        arm: String,
        /// Rholang argument text, for example '"1111abc"'.
        #[arg(long, default_value = "")]
        args: String,
    },
    /// Resolve a component key from a PrintRoot.
    Resolve {
        #[arg(long)]
        root: String,
        #[arg(long)]
        key: String,
    },
    /// Sign and submit a term. The keystore password never comes from argv.
    Submit {
        /// A term literal, a file path, or `-` for stdin.
        #[arg(long)]
        term: String,
        #[arg(long)]
        keystore: String,
        #[arg(long)]
        password_env: Option<String>,
        #[arg(long)]
        password_file: Option<String>,
        #[arg(long, default_value_t = 4_000_000)]
        phlo_limit: i64,
        #[arg(long, default_value_t = 1)]
        phlo_price: i64,
        #[arg(long, default_value = "/root")]
        shard: String,
        /// Print the deploy id and return without waiting for processing/finality.
        #[arg(long)]
        no_wait: bool,
    },
    /// Keystore and signing helpers.
    Wallet {
        #[command(subcommand)]
        command: WalletCommand,
    },
    Publication {
        #[command(subcommand)]
        command: PublicationCommand,
    },
    Commission {
        #[command(subcommand)]
        command: CommissionCommand,
    },
    Article {
        #[command(subcommand)]
        command: ArticleCommand,
    },
    Edition {
        #[command(subcommand)]
        command: EditionCommand,
    },
}

#[derive(Subcommand)]
enum WalletCommand {
    /// Generate a key and write the encrypted v3 keystore.
    Create {
        #[arg(long)]
        out: PathBuf,
        #[arg(long)]
        password_env: Option<String>,
        #[arg(long)]
        password_file: Option<String>,
    },
    /// Print the REV address and public key for a keystore.
    Address {
        #[arg(long)]
        keystore: PathBuf,
        #[arg(long)]
        password_env: Option<String>,
        #[arg(long)]
        password_file: Option<String>,
    },
    /// Sign a canonical text payload (for example the Codec admin payload).
    SignPayload {
        #[arg(long)]
        keystore: PathBuf,
        #[arg(long)]
        payload: String,
        #[arg(long)]
        password_env: Option<String>,
        #[arg(long)]
        password_file: Option<String>,
    },
    /// Sign an edition manifest described by JSON: editionId, publicationId, number,
    /// titleHash, coverHash, articleHashes.
    SignEdition {
        #[arg(long)]
        keystore: PathBuf,
        /// JSON or @path.
        #[arg(long)]
        manifest: String,
        #[arg(long)]
        password_env: Option<String>,
        #[arg(long)]
        password_file: Option<String>,
    },
}

#[derive(Subcommand)]
enum PublicationCommand {
    Create {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        id: String,
        /// JSON data or @path.
        #[arg(long)]
        charter: String,
        /// JSON array or @path.
        #[arg(long)]
        members: String,
    },
    AddMember {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        member: String,
        #[arg(long)]
        role: String,
        #[arg(long)]
        did: String,
        #[arg(long, default_value = "")]
        attestation: String,
    },
    RemoveMember {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        member: String,
    },
    SetRole {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        member: String,
        #[arg(long)]
        role: String,
    },
    AttestSelf {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        did: String,
        #[arg(long, default_value = "")]
        attestation: String,
    },
    Pause {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        /// Resume instead of pausing.
        #[arg(long)]
        resume: bool,
    },
    Admin {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        nonce: u64,
        #[arg(long)]
        action: String,
        /// JSON arguments or @path.
        #[arg(long, default_value = "[]")]
        args: String,
        /// DER signature hex; repeat for each signer.
        #[arg(long = "sig")]
        sigs: Vec<String>,
    },
}

#[derive(Subcommand)]
enum CommissionCommand {
    Propose {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        id: String,
        #[arg(long)]
        data: String,
    },
    Accept {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
    },
    Fund {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
    },
    CancelProposal {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        reason: String,
    },
    Submit {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        milestone: String,
        #[arg(long)]
        evidence: String,
    },
    Release {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        milestone: String,
    },
    AttachCover {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        cover: String,
    },
    CancelEscrow {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        reason: String,
    },
    Dispute {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        reason: String,
    },
    Arbitrate {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        nonce: u64,
        #[arg(long)]
        writer_bps: u32,
        /// DER signature hex; repeat for each signer.
        #[arg(long = "sig")]
        sigs: Vec<String>,
        #[arg(long)]
        op: String,
    },
    ResolveDispute {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
    },
    Expire {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
    },
}

#[derive(Subcommand)]
enum ArticleCommand {
    Create {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        id: String,
        #[arg(long)]
        data: String,
    },
    Submit {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        content_hash: String,
    },
    AttachKnowledge {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        kasset: String,
        #[arg(long)]
        claim: String,
        #[arg(long)]
        provenance: String,
        #[arg(long, default_value = "")]
        credential: String,
    },
    Attest {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        attestation: String,
        #[arg(long)]
        kind: String,
        #[arg(long)]
        evidence: String,
    },
    Approve {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
    },
    Publish {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
    },
    Correct {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        correction: String,
        #[arg(long)]
        kind: String,
        #[arg(long)]
        body: String,
        #[arg(long)]
        reason: String,
    },
    Retract {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        reason: String,
    },
}

#[derive(Subcommand)]
enum EditionCommand {
    Create {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        id: String,
        #[arg(long)]
        data: String,
    },
    Append {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        #[arg(long)]
        article: String,
    },
    Seal {
        #[arg(long)]
        uri: String,
        #[arg(long)]
        op: String,
        /// DER signature hex over the canonical manifest hash (see `wallet sign-edition`).
        #[arg(long)]
        signature: String,
    },
}

fn json_arg(value: &str) -> Value {
    let text = if let Some(path) = value.strip_prefix('@') {
        fs::read_to_string(PathBuf::from(path)).unwrap_or_else(|error| {
            eprintln!("rprint: cannot read {path}: {error}");
            std::process::exit(2);
        })
    } else {
        value.to_string()
    };
    serde_json::from_str(&text).unwrap_or_else(|error| {
        eprintln!("rprint: invalid JSON: {error}");
        std::process::exit(2);
    })
}

fn password(env: &Option<String>, file: &Option<String>) -> CliResult<String> {
    match (env, file) {
        (Some(name), _) => std::env::var(name).map_err(|_| format!("{name} is not set")),
        (None, Some(path)) => fs::read_to_string(path)
            .map(|text| text.trim_end().to_string())
            .map_err(|error| format!("cannot read {path}: {error}")),
        (None, None) => Err("provide --password-env or --password-file".to_string()),
    }
}

fn read_term(text: &str) -> CliResult<String> {
    if text == "-" {
        let mut term = String::new();
        std::io::stdin()
            .read_to_string(&mut term)
            .map_err(|error| format!("cannot read stdin: {error}"))?;
        return Ok(term);
    }
    let path = PathBuf::from(text);
    if path.is_file() {
        return fs::read_to_string(path).map_err(|error| format!("cannot read {text}: {error}"));
    }
    Ok(text.to_string())
}

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli).await {
        Ok(code) => code,
        Err(error) => {
            eprintln!("rprint: {error}");
            ExitCode::from(2)
        }
    }
}

async fn run(cli: Cli) -> CliResult<ExitCode> {
    let node_url = cli.node;
    match cli.command {
        Command::Version => {
            println!("rprint {}", rprint_core::VERSION);
            Ok(ExitCode::SUCCESS)
        }
        Command::Call { uri, binding, args } => {
            print!(
                "{}",
                sdk::call_term(
                    &uri,
                    &binding,
                    if args.is_empty() { None } else { Some(&args) }
                )
            );
            Ok(ExitCode::SUCCESS)
        }
        Command::AdminPayload {
            domain,
            nonce,
            action,
            args,
        } => {
            let refs: Vec<&str> = args.iter().map(String::as_str).collect();
            println!("{}", sdk::admin_payload(&domain, nonce, &action, &refs));
            Ok(ExitCode::SUCCESS)
        }
        Command::Read { uri, arm, args } => read(&node_url, &uri, &arm, &args).await,
        Command::Resolve { root, key } => resolve(&node_url, &root, &key).await,
        Command::Submit {
            term,
            keystore,
            password_env,
            password_file,
            phlo_limit,
            phlo_price,
            shard,
            no_wait,
        } => {
            submit(SubmitArgs {
                node_url,
                term: read_term(&term)?,
                keystore: PathBuf::from(keystore),
                password_env,
                password_file,
                phlo_limit,
                phlo_price,
                shard,
                no_wait,
            })
            .await
        }
        Command::Wallet { command } => wallet(command).await,
        Command::Publication { command } => {
            print!("{}", publication_term(command));
            Ok(ExitCode::SUCCESS)
        }
        Command::Commission { command } => {
            print!("{}", commission_term(command));
            Ok(ExitCode::SUCCESS)
        }
        Command::Article { command } => {
            print!("{}", article_term(command));
            Ok(ExitCode::SUCCESS)
        }
        Command::Edition { command } => {
            print!("{}", edition_term(command));
            Ok(ExitCode::SUCCESS)
        }
    }
}

async fn read(node_url: &str, uri: &str, arm: &str, args: &str) -> CliResult<ExitCode> {
    let term = sdk::explore_call_term(uri, arm, if args.is_empty() { None } else { Some(args) });
    let client = NodeClient::new(node_url).map_err(|error| error.to_string())?;
    let response = client
        .explore(&term)
        .await
        .map_err(|error| error.to_string())?;
    let first = response.expr.first().ok_or_else(|| {
        "explore-deploy returned no value; the term must reply on its first private name"
            .to_string()
    })?;
    let reply =
        decode_reply_json(&serde_json::to_string(first).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
    println!(
        "{}",
        serde_json::to_string(&reply).map_err(|error| error.to_string())?
    );
    Ok(if reply.ok {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(1)
    })
}

async fn resolve(node_url: &str, root: &str, key: &str) -> CliResult<ExitCode> {
    let quoted = serde_json::to_string(key).map_err(|error| error.to_string())?;
    read(node_url, root, "resolve", &format!("{quoted}, 1")).await
}

struct SubmitArgs {
    node_url: String,
    term: String,
    keystore: PathBuf,
    password_env: Option<String>,
    password_file: Option<String>,
    phlo_limit: i64,
    phlo_price: i64,
    shard: String,
    no_wait: bool,
}

async fn submit(args: SubmitArgs) -> CliResult<ExitCode> {
    let SubmitArgs {
        node_url,
        term,
        keystore,
        password_env,
        password_file,
        phlo_limit,
        phlo_price,
        shard,
        no_wait,
    } = args;
    let document = fs::read_to_string(&keystore)
        .map_err(|error| format!("cannot read {}: {error}", keystore.display()))?;
    let passphrase = password(&password_env, &password_file)?;
    let (wallet, _) = Wallet::unlock(&document, &passphrase).map_err(|error| error.to_string())?;
    let client = NodeClient::new(&node_url).map_err(|error| error.to_string())?;
    let tip = client
        .latest_block_number()
        .await
        .map_err(|error| error.to_string())?;
    let signed = wallet
        .sign_deploy(
            &term,
            &DeploySignOptions {
                valid_after: tip,
                phlo_limit,
                phlo_price,
                shard,
                timestamp_millis: None,
            },
        )
        .map_err(|error| error.to_string())?;
    let body = serde_json::to_string(&signed.body).map_err(|error| error.to_string())?;
    match client
        .deploy_body(&body, &signed.deploy_id, term.len())
        .await
    {
        Ok(()) => {}
        Err(ChainError::Duplicate { .. }) => {}
        Err(error) => return Err(error.to_string()),
    }
    if no_wait {
        println!(
            "{}",
            serde_json::json!({ "deployId": signed.deploy_id, "status": "submitted" })
        );
        return Ok(ExitCode::SUCCESS);
    }
    let policy = PollPolicy::default();
    let status = client
        .wait_processed(&signed.deploy_id, policy)
        .await
        .map_err(|error| format!("deploy {}: {error}", signed.deploy_id))?;
    match status {
        DeployStatus::ProcessedWithSuccess {
            deploy_result,
            block,
        } => {
            client
                .wait_finalized(&block.block_hash, policy)
                .await
                .map_err(|error| {
                    format!(
                        "deploy {} processed in {} but not final: {error}",
                        signed.deploy_id, block.block_hash
                    )
                })?;
            let reply = match deploy_result.first() {
                Some(value) => decode_reply_json(
                    &serde_json::to_string(value).map_err(|error| error.to_string())?,
                )
                .map_err(|error| error.to_string())?,
                None => return Err("deploy succeeded but returned no value".to_string()),
            };
            println!(
                "{}",
                serde_json::json!({
                    "deployId": signed.deploy_id,
                    "blockHash": block.block_hash,
                    "blockNumber": block.block_number,
                    "reply": reply,
                })
            );
            Ok(if reply.ok {
                ExitCode::SUCCESS
            } else {
                ExitCode::from(1)
            })
        }
        DeployStatus::ProcessedWithError {
            deploy_error,
            block,
        } => {
            eprintln!(
                "rprint: deploy {} failed in {}: {deploy_error}",
                signed.deploy_id, block.block_hash
            );
            Ok(ExitCode::from(2))
        }
        DeployStatus::NotProcessed { status } => {
            eprintln!(
                "rprint: deploy {} not processed: {status}",
                signed.deploy_id
            );
            Ok(ExitCode::from(2))
        }
    }
}

async fn wallet(command: WalletCommand) -> CliResult<ExitCode> {
    match command {
        WalletCommand::Create {
            out,
            password_env,
            password_file,
        } => {
            let passphrase = password(&password_env, &password_file)?;
            let (_wallet, document, info) =
                Wallet::create(&passphrase).map_err(|error| error.to_string())?;
            fs::write(&out, document)
                .map_err(|error| format!("cannot write {}: {error}", out.display()))?;
            println!(
                "{}",
                serde_json::json!({
                    "address": info.address,
                    "publicKey": info.public_key,
                    "keystore": out,
                })
            );
        }
        WalletCommand::Address {
            keystore,
            password_env,
            password_file,
        } => {
            let (wallet, _) = unlock(&keystore, password_env, password_file)?;
            let info = wallet
                .info()
                .ok_or_else(|| "wallet is locked".to_string())?;
            println!(
                "{}",
                serde_json::json!({ "address": info.address, "publicKey": info.public_key })
            );
        }
        WalletCommand::SignPayload {
            keystore,
            payload,
            password_env,
            password_file,
        } => {
            let (wallet, _) = unlock(&keystore, password_env, password_file)?;
            println!(
                "{}",
                wallet
                    .sign_text_payload(&payload)
                    .map_err(|error| error.to_string())?
            );
        }
        WalletCommand::SignEdition {
            keystore,
            manifest,
            password_env,
            password_file,
        } => {
            let value = json_arg(&manifest);
            let edition_id = string_field(&value, "editionId")?;
            let publication_id = string_field(&value, "publicationId")?;
            let number = value["number"]
                .as_u64()
                .ok_or_else(|| "manifest.number must be an integer".to_string())?;
            let title_hash = string_field(&value, "titleHash")?;
            let cover_hash = string_field(&value, "coverHash")?;
            let article_hashes = value["articleHashes"]
                .as_array()
                .ok_or_else(|| "manifest.articleHashes must be an array".to_string())?
                .iter()
                .map(|item| {
                    item.as_str()
                        .map(str::to_string)
                        .ok_or_else(|| "articleHashes entries must be strings".to_string())
                })
                .collect::<CliResult<Vec<String>>>()?;
            let (wallet, _) = unlock(&keystore, password_env, password_file)?;
            let (manifest_hash, signature) = wallet
                .sign_edition_manifest(
                    &edition_id,
                    &publication_id,
                    number,
                    &title_hash,
                    &cover_hash,
                    &article_hashes,
                )
                .map_err(|error| error.to_string())?;
            println!(
                "{}",
                serde_json::json!({
                    "manifestHash": manifest_hash,
                    "signature": signature,
                })
            );
        }
    }
    Ok(ExitCode::SUCCESS)
}

fn unlock(
    keystore: &PathBuf,
    password_env: Option<String>,
    password_file: Option<String>,
) -> CliResult<(Wallet, rprint_wallet::WalletInfo)> {
    let document = fs::read_to_string(keystore)
        .map_err(|error| format!("cannot read {}: {error}", keystore.display()))?;
    let passphrase = password(&password_env, &password_file)?;
    Wallet::unlock(&document, &passphrase).map_err(|error| error.to_string())
}

fn string_field(value: &Value, field: &str) -> CliResult<String> {
    value[field]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| format!("manifest.{field} must be a string"))
}

fn publication_term(command: PublicationCommand) -> String {
    match command {
        PublicationCommand::Create {
            uri,
            op,
            id,
            charter,
            members,
        } => sdk::create_publication_term(&uri, &op, &id, &json_arg(&charter), &json_arg(&members)),
        PublicationCommand::AddMember {
            uri,
            op,
            member,
            role,
            did,
            attestation,
        } => sdk::publication_add_member_term(&uri, &op, &member, &role, &did, &attestation),
        PublicationCommand::RemoveMember { uri, op, member } => {
            sdk::publication_remove_member_term(&uri, &op, &member)
        }
        PublicationCommand::SetRole {
            uri,
            op,
            member,
            role,
        } => sdk::publication_set_role_term(&uri, &op, &member, &role),
        PublicationCommand::AttestSelf {
            uri,
            op,
            did,
            attestation,
        } => sdk::publication_attest_self_term(&uri, &op, &did, &attestation),
        PublicationCommand::Pause { uri, op, resume } => {
            sdk::publication_pause_term(&uri, &op, !resume)
        }
        PublicationCommand::Admin {
            uri,
            nonce,
            action,
            args,
            sigs,
        } => sdk::publication_admin_term(&uri, nonce, &action, &json_arg(&args), &sigs),
    }
}

fn commission_term(command: CommissionCommand) -> String {
    match command {
        CommissionCommand::Propose { uri, op, id, data } => {
            sdk::propose_commission_term(&uri, &op, &id, &json_arg(&data))
        }
        CommissionCommand::Accept { uri, op } => sdk::proposal_accept_term(&uri, &op),
        CommissionCommand::Fund { uri, op } => sdk::proposal_fund_term(&uri, &op),
        CommissionCommand::CancelProposal { uri, op, reason } => {
            sdk::proposal_cancel_term(&uri, &op, &reason)
        }
        CommissionCommand::Submit {
            uri,
            op,
            milestone,
            evidence,
        } => sdk::escrow_submit_term(&uri, &op, &milestone, &evidence),
        CommissionCommand::Release { uri, op, milestone } => {
            sdk::escrow_release_term(&uri, &op, &milestone)
        }
        CommissionCommand::AttachCover { uri, op, cover } => {
            sdk::proposal_attach_cover_term(&uri, &op, &cover)
        }
        CommissionCommand::CancelEscrow { uri, op, reason } => {
            sdk::escrow_cancel_term(&uri, &op, &reason)
        }
        CommissionCommand::Dispute { uri, op, reason } => {
            sdk::escrow_dispute_term(&uri, &op, &reason)
        }
        CommissionCommand::Arbitrate {
            uri,
            nonce,
            writer_bps,
            sigs,
            op,
        } => sdk::escrow_arbitrate_term(&uri, nonce, writer_bps, &sigs, &op),
        CommissionCommand::ResolveDispute { uri, op } => {
            sdk::escrow_resolve_dispute_term(&uri, &op)
        }
        CommissionCommand::Expire { uri, op } => sdk::escrow_expire_term(&uri, &op),
    }
}

fn article_term(command: ArticleCommand) -> String {
    match command {
        ArticleCommand::Create { uri, op, id, data } => {
            sdk::create_article_term(&uri, &op, &id, &json_arg(&data))
        }
        ArticleCommand::Submit {
            uri,
            op,
            content_hash,
        } => sdk::article_submit_term(&uri, &op, &content_hash),
        ArticleCommand::AttachKnowledge {
            uri,
            op,
            kasset,
            claim,
            provenance,
            credential,
        } => {
            sdk::article_attach_knowledge_term(&uri, &op, &kasset, &claim, &provenance, &credential)
        }
        ArticleCommand::Attest {
            uri,
            op,
            attestation,
            kind,
            evidence,
        } => sdk::article_attest_term(&uri, &op, &attestation, &kind, &evidence),
        ArticleCommand::Approve { uri, op } => sdk::article_approve_term(&uri, &op),
        ArticleCommand::Publish { uri, op } => sdk::article_publish_term(&uri, &op),
        ArticleCommand::Correct {
            uri,
            op,
            correction,
            kind,
            body,
            reason,
        } => sdk::article_correct_term(&uri, &op, &correction, &kind, &body, &reason),
        ArticleCommand::Retract { uri, op, reason } => {
            sdk::article_retract_term(&uri, &op, &reason)
        }
    }
}

fn edition_term(command: EditionCommand) -> String {
    match command {
        EditionCommand::Create { uri, op, id, data } => {
            sdk::create_edition_term(&uri, &op, &id, &json_arg(&data))
        }
        EditionCommand::Append { uri, op, article } => {
            sdk::edition_append_term(&uri, &op, &article)
        }
        EditionCommand::Seal { uri, op, signature } => {
            sdk::edition_seal_term(&uri, &op, &signature)
        }
    }
}
