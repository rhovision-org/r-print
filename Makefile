PY ?= .venv/bin/python
MDBOOK ?= mdbook
RCASH_DIR ?= ../Rholphin
RHOLO_DIR ?= ../RNodeRust
NODE ?= http://localhost:40403

# Make every recipe and its Python children use the same absolute checkout. CI sets
# RCASH_DIR to its `rholo` checkout, so no sibling named Rholphin exists there.
export RCASH_DIR := $(abspath $(RCASH_DIR))
export RHOLO_DIR := $(abspath $(RHOLO_DIR))

.PHONY: venv build build-check measure measure-check metrics metrics-compare \
        metrics-baseline check-arch check-captures check-select check-placeholders \
        check-money check-suites check-flows check-vectors check spec-check parse-check \
        docs docs-serve docs-check devnet devnet-up devnet-wait down status rcash-install \
        rcash-keys rcash-bootstrap keys install setup unit-all check-all ci clean \
        client-lint client-test client-wasm client-wasm-smoke client-check \
        web-install web-test web-build

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

spec-check: build-check measure-check check-arch check-captures check-select \
            check-placeholders check-money check-suites

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

unit-all:
	$(PY) harness/run_suites.py

client-lint:
	cargo fmt --all --check
	cargo clippy --workspace --all-targets -- -D warnings

client-test:
	cargo test --workspace

client-wasm:
	cargo check -p rprint-wasm --target wasm32-unknown-unknown

client-wasm-smoke:
	node web/tests/wasm-smoke.mjs

client-check: client-lint client-test client-wasm

web-install:
	npm --prefix web ci --no-audit --no-fund

web-test:
	npm --prefix web test -- --run

web-build:
	npm --prefix web run build

check: spec-check parse-check docs-check client-check

ci: check unit-all

clean:
	cargo clean
	rm -rf docs/book
