//! The `rprint` command-line term builder.
//!
//! v0.1 is a dry-run client: it prints the canonical Rholang call term for an operation.
//! Signing and submission stay with r-cash's signed-deploy client.

use std::fs;
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use rprint_sdk as sdk;
use serde_json::Value;

#[derive(Parser)]
#[command(name = "rprint", version = rprint_core::VERSION)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Print the protocol version.
    Version,
    /// Build a registry call term.
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

fn main() {
    let cli = Cli::parse();
    let term = match cli.command {
        Command::Version => {
            println!("rprint {}", rprint_core::VERSION);
            return;
        }
        Command::Call { uri, binding, args } => sdk::call_term(
            &uri,
            &binding,
            if args.is_empty() { None } else { Some(&args) },
        ),
        Command::AdminPayload {
            domain,
            nonce,
            action,
            args,
        } => {
            let refs: Vec<&str> = args.iter().map(String::as_str).collect();
            println!("{}", sdk::admin_payload(&domain, nonce, &action, &refs));
            return;
        }
        Command::Publication {
            command:
                PublicationCommand::Create {
                    uri,
                    op,
                    id,
                    charter,
                    members,
                },
        } => sdk::create_publication_term(&uri, &op, &id, &json_arg(&charter), &json_arg(&members)),
        Command::Commission { command } => match command {
            CommissionCommand::Propose { uri, op, id, data } => {
                sdk::propose_commission_term(&uri, &op, &id, &json_arg(&data))
            }
            CommissionCommand::Accept { uri, op } => sdk::proposal_accept_term(&uri, &op),
            CommissionCommand::Fund { uri, op } => sdk::proposal_fund_term(&uri, &op),
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
        },
        Command::Article { command } => match command {
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
            } => sdk::article_attach_knowledge_term(
                &uri,
                &op,
                &kasset,
                &claim,
                &provenance,
                &credential,
            ),
            ArticleCommand::Approve { uri, op } => sdk::article_approve_term(&uri, &op),
            ArticleCommand::Publish { uri, op } => sdk::article_publish_term(&uri, &op),
        },
        Command::Edition { command } => match command {
            EditionCommand::Create { uri, op, id, data } => {
                sdk::create_edition_term(&uri, &op, &id, &json_arg(&data))
            }
            EditionCommand::Append { uri, op, article } => {
                sdk::edition_append_term(&uri, &op, &article)
            }
            EditionCommand::Seal { uri, op, signature } => {
                sdk::edition_seal_term(&uri, &op, &signature)
            }
        },
    };
    print!("{term}");
}
