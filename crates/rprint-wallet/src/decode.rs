//! Decode a node `RhoExpr` reply into the client's `{ok, values|reason}` shape.

use rcash_chain::rho_expr::{Reply, RhoValue};
use serde::Serialize;
use serde_json::Value;

use crate::WalletError;

/// The decoded reply. `values` excludes the leading `true`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyJson {
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub values: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Decode one node `RhoExpr` value.
///
/// The node sometimes emits `ExprByteArray`; r-cash's decoder only knows `ExprBytes`, so
/// normalize the tag first. A non-tuple value is treated as a bare successful value (for
/// example `Codec("adminPayload")`). A tuple whose first item is not a boolean is also
/// treated as bare data rather than as a malformed reply.
pub fn decode_reply_json(expr_json: &str) -> Result<ReplyJson, WalletError> {
    let value: Value =
        serde_json::from_str(expr_json).map_err(|error| WalletError::Decode(error.to_string()))?;
    let normalized = normalize(&value);
    let decoded =
        RhoValue::decode(&normalized).map_err(|error| WalletError::Decode(error.to_string()))?;
    match Reply::from_value(&decoded) {
        Ok(Reply::Ok(values)) => Ok(ReplyJson {
            ok: true,
            values: values.iter().map(RhoValue::to_json).collect(),
            reason: None,
        }),
        Ok(Reply::Refused(reason)) => Ok(ReplyJson {
            ok: false,
            values: Vec::new(),
            reason: Some(reason),
        }),
        Err(_) => Ok(ReplyJson {
            ok: true,
            values: vec![decoded.to_json()],
            reason: None,
        }),
    }
}

/// Recursively rename `ExprByteArray` to `ExprBytes`.
fn normalize(value: &Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.iter().map(normalize).collect()),
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for (key, item) in map {
                let key = if key == "ExprByteArray" {
                    "ExprBytes".to_string()
                } else {
                    key.clone()
                };
                out.insert(key, normalize(item));
            }
            Value::Object(out)
        }
        _ => value.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_a_success_tuple() {
        let json = r#"{"ExprTuple":{"data":[{"ExprBool":{"data":true}},{"ExprInt":{"data":3}}]}}"#;
        let reply = decode_reply_json(json).unwrap();
        assert!(reply.ok);
        assert_eq!(reply.values, vec![Value::from(3)]);
        assert!(reply.reason.is_none());
    }

    #[test]
    fn decodes_a_refusal() {
        let json = r#"{"ExprTuple":{"data":[{"ExprBool":{"data":false}},{"ExprString":{"data":"status"}}]}}"#;
        let reply = decode_reply_json(json).unwrap();
        assert!(!reply.ok);
        assert_eq!(reply.reason.as_deref(), Some("status"));
    }

    #[test]
    fn decodes_nil_as_an_empty_tuple() {
        let json = r#"{"ExprTuple":{"data":[{"ExprBool":{"data":true}},{"ExprPar":{"data":[]}}]}}"#;
        let reply = decode_reply_json(json).unwrap();
        assert!(reply.ok);
        assert_eq!(reply.values, vec![Value::Array(vec![])]);
    }

    #[test]
    fn decodes_a_bare_value() {
        let json = r#"{"ExprString":{"data":"rprint:admin:v1|d|1|pause|"}}"#;
        let reply = decode_reply_json(json).unwrap();
        assert!(reply.ok);
        assert_eq!(
            reply.values,
            vec![Value::from("rprint:admin:v1|d|1|pause|")]
        );
    }

    #[test]
    fn normalizes_byte_arrays() {
        let json = r#"{"ExprByteArray":{"data":"aabb"}}"#;
        let reply = decode_reply_json(json).unwrap();
        assert!(reply.ok);
        assert_eq!(reply.values, vec![Value::from("aabb")]);
    }

    #[test]
    fn malformed_json_is_an_error() {
        assert!(decode_reply_json("not json").is_err());
        assert!(decode_reply_json(r#"{"ExprUnknown":{"data":1}}"#).is_err());
    }
}
