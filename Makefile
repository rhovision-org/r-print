PY ?= .venv/bin/python
MDBOOK ?= mdbook
RCASH_DIR ?= ../Rholphin
RHOLO_DIR ?= ../RNodeRust
NODE ?= http://localhost:40403
WASM_PACK ?= wasm-pack
SIBLINGS_DIR ?= ..
RGEN_DIR ?= $(abspath $(SIBLINGS_DIR)/RGen)
RSURE_DIR ?= $(abspath $(SIBLINGS_DIR)/RSure)
KEYFILE ?= $(abspath .devnet/keys.json)
SIBLING_SUITES = cover,knowledge
RPRINT_SIBLINGS ?= 0

# Make every recipe and its Python children use the same absolute checkout. CI sets
# RCASH_DIR to its `rholo` checkout, so no sibling named Rholphin exists there.
export RCASH_DIR := $(abspath $(RCASH_DIR))
export RHOLO_DIR := $(abspath $(RHOLO_DIR))
export RPRINT_SIBLINGS_DIR := $(abspath $(SIBLINGS_DIR))

.PHONY: venv build build-check measure measure-check metrics metrics-compare \
        metrics-baseline check-arch check-captures check-select check-placeholders \
        check-money check-suites check-graph check-flows check-vectors \
        check-guard-bridge check-race-matrix check-rigor check-conformance \
        check-core-vectors gen-core-vectors check-client-ops check-capabilities \
        check-schemas check-arm-inventory \
        check-audit check-closeout check-hazop check-redteam-results redteam \
        check spec-check parse-check \
        lean-build lean-check lean-vectors lean-vectors-write check-flows-strict formal-check \
        docs docs-serve docs-check devnet devnet-up devnet-wait down status rcash-install \
        rcash-keys rcash-bootstrap keys install setup unit-all check-all ci clean \
        client-lint client-test client-wasm client-wasm-pack client-wasm-node \
        client-wasm-smoke client-live cli-live wasm-build client-check \
        web-install web-test web-build web-e2e-install web-e2e-fixture web-e2e-live \
        siblings-venv siblings-install install-with-siblings sibling-fixture \
        sibling-suites sibling-suites-strict siblings-campaign

venv:
	python3 -m venv .venv
	$(PY) -m pip -q install --upgrade pip
	$(PY) -m pip -q install -r harness/requirements.txt

build:
	$(PY) tools/build_contracts.py

build-check:
	$(PY) tools/build_contracts.py --check

measure:
	$(PY) tools/measure_contracts.py --write

measure-check:
	$(PY) tools/measure_contracts.py --check

metrics:
	$(PY) tools/metrics.py --write contracts/metrics-current.json

metrics-compare:
	$(PY) tools/metrics.py --compare contracts/metrics-baseline.json

metrics-baseline:
	$(PY) tools/metrics.py --write-baseline

check-arch:
	$(PY) tools/check_arch.py

check-captures:
	$(PY) tools/check_captures.py

check-select:
	$(PY) tools/check_select.py

check-placeholders:
	$(PY) tools/check_placeholders.py

check-money:
	$(PY) tools/check_money.py

check-suites:
	$(PY) tools/check_suites.py

check-flows:
	$(PY) tools/check_flows.py

check-vectors:
	$(PY) tools/check_vectors.py

check-guard-bridge:
	$(PY) tools/check_guard_bridge.py

check-race-matrix:
	$(PY) tools/check_race_matrix.py

check-rigor:
	$(PY) tools/check_rigor.py

check-conformance:
	$(PY) tools/check_conformance.py

check-core-vectors:
	$(PY) tools/check_core_vectors.py

gen-core-vectors:
	$(PY) tools/gen_core_vectors.py --write

check-client-ops:
	$(PY) tools/check_client_ops.py

check-capabilities:
	$(PY) tools/check_capabilities.py

check-schemas:
	$(PY) tools/check_schemas.py

check-arm-inventory:
	$(PY) tools/check_arm_inventory.py

check-audit:
	$(PY) tools/check_audit.py

check-closeout:
	$(PY) tools/check_closeout.py

check-hazop:
	$(PY) tools/check_hazop.py

check-redteam-results:
	$(PY) tools/check_redteam_results.py

redteam:
	$(PY) harness/run_suites.py --suites redteam \
		--results deployments/redteam-suite-results.json --require-run

lean-build:
	cd spec/lean && lake build

lean-check:
	$(PY) tools/check_lean.py

lean-vectors-write:
	$(PY) tools/gen_lean_vectors.py --write

lean-vectors:
	$(PY) tools/check_lean_vectors.py

check-flows-strict:
	$(PY) tools/check_flows.py --strict

formal-check: lean-check lean-vectors check-core-vectors check-flows check-flows-strict

check-graph:
	$(PY) tools/check_graph.py

spec-check: build-check measure-check metrics-compare check-arch check-captures check-select \
            check-placeholders check-money check-suites check-graph check-flows check-vectors \
            check-guard-bridge check-race-matrix check-rigor check-conformance \
            check-client-ops check-capabilities check-schemas check-arm-inventory \
            check-audit check-closeout check-hazop

parse-check:
	$(PY) harness/install.py --dry-run --profile safe
	tools/parse_check.sh contracts/build/*.rho .devnet/rendered/*.rho

docs:
	$(MDBOOK) build

docs-serve:
	$(MDBOOK) serve --open

docs-check:
	$(PY) tools/check_docs.py
	$(MDBOOK) build

devnet:
	$(MAKE) -C $(RCASH_DIR) devnet RHOLO_DIR=$(abspath $(RHOLO_DIR))

devnet-up:
	-$(MAKE) -C $(RCASH_DIR) down RHOLO_DIR=$(abspath $(RHOLO_DIR))
	$(MAKE) -C $(RCASH_DIR) devnet RHOLO_DIR=$(abspath $(RHOLO_DIR))
	$(PY) harness/preflight.py --wait 300

devnet-wait:
	$(PY) harness/preflight.py --wait 300

down:
	$(MAKE) -C $(RCASH_DIR) down RHOLO_DIR=$(abspath $(RHOLO_DIR))

status:
	@curl -s $(NODE)/api/v1/status | $(PY) -m json.tool || echo "devnet not running"

rcash-install:
	$(MAKE) -C $(RCASH_DIR) install RHOLO_DIR=$(RHOLO_DIR)

rcash-keys:
	$(MAKE) -C $(RCASH_DIR) keys RHOLO_DIR=$(RHOLO_DIR)

rcash-bootstrap:
	$(PY) harness/rcash_bootstrap.py --rcash $(RCASH_DIR) --node $(NODE)

keys:
	$(PY) tools/keygen.py --out .devnet/keys.json \
		--from-path $(RCASH_DIR)/.devnet/keys.json

install:
	$(PY) harness/install.py --node $(NODE) --profile safe

setup: devnet-up rcash-keys rcash-bootstrap keys install

# Optional sibling surfaces. The defaults resolve the checkouts next to r-print; CI
# sets SIBLINGS_DIR to $GITHUB_WORKSPACE/siblings.
siblings-venv:
	$(PY) -m pip -q install -r $(RSURE_DIR)/harness/requirements.txt \
		-r $(RGEN_DIR)/harness/requirements.txt

siblings-install:
	cd $(RSURE_DIR) && \
		RSHARE_KEYS=$(KEYFILE) RSURE_KEYS=$(KEYFILE) RSHARE_NODE=$(NODE) \
		RSURE_NODE=$(NODE) $(abspath $(PY)) harness/install.py --node $(NODE)
	cd $(RGEN_DIR) && \
		RGEN_KEYS=$(KEYFILE) RGEN_NODE=$(NODE) \
		RGEN_MANIFEST=$(RGEN_DIR)/deployments/devnet.json \
		$(abspath $(PY)) harness/install.py --node $(NODE) --fresh

install-with-siblings:
	RPRINT_SIBLINGS=1 $(PY) harness/install.py --node $(NODE) --profile safe --siblings

sibling-fixture:
	$(PY) harness/sibling_fixture.py --write

sibling-suites: sibling-fixture
	RPRINT_SIBLING_FIXTURE=deployments/sibling-fixture.json \
		$(PY) harness/run_suites.py --suites $(SIBLING_SUITES) \
		--results deployments/sibling-suite-results.json --optional

sibling-suites-strict: sibling-fixture
	RPRINT_SIBLING_FIXTURE=deployments/sibling-fixture.json \
		$(PY) harness/run_suites.py --suites $(SIBLING_SUITES) \
		--results deployments/sibling-suite-results.json --require-run

siblings-campaign: devnet-up rcash-keys rcash-bootstrap keys siblings-venv \
		siblings-install install-with-siblings sibling-suites-strict

unit-all:
	$(PY) harness/run_suites.py

client-lint:
	cargo fmt --all --check
	cargo clippy --workspace --all-targets -- -D warnings

client-test:
	cargo test --workspace

client-wasm:
	cargo check -p rprint-wasm --target wasm32-unknown-unknown

client-wasm-pack:
	$(WASM_PACK) build crates/rprint-wasm --target web --release \
		--out-dir $(abspath web/public/wasm)

client-wasm-node:
	$(WASM_PACK) build crates/rprint-wasm --target nodejs --release \
		--out-dir $(abspath web/tests/wasm-node)

client-wasm-smoke: client-wasm-node
	node web/tests/wasm-smoke.mjs

# Live smoke: real WASM signing + real HTTP against a healthy devnet.
client-live: client-wasm-node
	RPRINT_NODE=$(NODE) RPRINT_SIBLINGS=$(RPRINT_SIBLINGS) \
		npm --prefix web exec -- tsx web/tests/live-client.ts

# CLI live read/submit smoke, same devnet.
cli-live:
	RPRINT_NODE=$(NODE) RPRINT_SIBLINGS=$(RPRINT_SIBLINGS) \
		cargo test -p rprint-cli --test devnet_live -- \
		--ignored --test-threads=1

# Browser end-to-end. Fixture has no node or WASM dependency; live needs a devnet.
web-e2e-install:
	npm --prefix web run test:e2e:install

web-e2e-fixture:
	npm --prefix web run test:e2e:fixture

web-e2e-live: client-wasm-pack
	RPRINT_E2E_LIVE=1 RPRINT_NODE=$(NODE) RPRINT_REPO=$(abspath .) \
		npm --prefix web run test:e2e:live

wasm-build: client-wasm-pack

client-check: client-lint client-test client-wasm client-wasm-pack client-wasm-smoke \
	web-test web-build

web-install:
	npm --prefix web ci --no-audit --no-fund

web-test:
	npm --prefix web test -- --run

web-build:
	npm --prefix web run build

check: spec-check parse-check docs-check formal-check client-check

ci: check unit-all

clean:
	cargo clean
	rm -rf docs/book
