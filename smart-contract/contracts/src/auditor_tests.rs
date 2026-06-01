/// Tests for auditor registry and attestation verification.
/// Tests for batch recall propagation.
#[cfg(test)]
mod auditor_tests {
    use crate::{SupplyLinkContract, SupplyLinkContractClient};
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    fn setup() -> (Env, Address, SupplyLinkContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, SupplyLinkContract);
        let client = SupplyLinkContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);
        (env, contract_id, client)
    }

    fn make_str(env: &Env, s: &str) -> String {
        String::from_str(env, s)
    }

    fn register_product(
        env: &Env,
        client: &SupplyLinkContractClient,
        product_id: &str,
        owner: &Address,
    ) {
        client.register_product(
            &make_str(env, product_id),
            &make_str(env, "Widget"),
            &make_str(env, "Factory A"),
            owner,
            &1u32,
            &make_str(env, "general"),
            &make_str(env, "other"),
        );
    }

    // ── Admin initialization ──────────────────────────────────────────────────

    #[test]
    fn test_initialize_admin_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, SupplyLinkContract);
        let client = SupplyLinkContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        let result = client.initialize_admin(&admin);
        assert!(result);

        let stored_admin = client.get_admin();
        assert_eq!(stored_admin, Some(admin));
    }

    #[test]
    #[should_panic(expected = "admin already initialized")]
    fn test_initialize_admin_twice_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, SupplyLinkContract);
        let client = SupplyLinkContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        client.initialize_admin(&admin);
        client.initialize_admin(&admin); // should panic
    }

    // ── Auditor registration ──────────────────────────────────────────────────

    #[test]
    fn test_register_auditor_success() {
        let (env, _contract_id, client) = setup();
        let auditor_addr = Address::generate(&env);

        let auditor = client.register_auditor(
            &auditor_addr,
            &make_str(&env, "Acme Auditing Corp"),
        );

        assert_eq!(auditor.address, auditor_addr);
        assert_eq!(auditor.name, make_str(&env, "Acme Auditing Corp"));
        assert!(auditor.active);
    }

    #[test]
    #[should_panic(expected = "auditor already registered")]
    fn test_register_auditor_duplicate_panics() {
        let (env, _contract_id, client) = setup();
        let auditor_addr = Address::generate(&env);

        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp"));
        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp")); // should panic
    }

    #[test]
    fn test_is_active_auditor_returns_true_for_registered() {
        let (env, _contract_id, client) = setup();
        let auditor_addr = Address::generate(&env);

        assert!(!client.is_active_auditor(&auditor_addr));
        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp"));
        assert!(client.is_active_auditor(&auditor_addr));
    }

    #[test]
    fn test_deactivate_auditor_success() {
        let (env, _contract_id, client) = setup();
        let auditor_addr = Address::generate(&env);

        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp"));
        assert!(client.is_active_auditor(&auditor_addr));

        client.deactivate_auditor(&auditor_addr);
        assert!(!client.is_active_auditor(&auditor_addr));
    }

    #[test]
    #[should_panic(expected = "auditor not found")]
    fn test_deactivate_nonexistent_auditor_panics() {
        let (env, _contract_id, client) = setup();
        let auditor_addr = Address::generate(&env);
        client.deactivate_auditor(&auditor_addr); // should panic
    }

    // ── Attestation submission ────────────────────────────────────────────────

    #[test]
    fn test_submit_attestation_success() {
        let (env, _contract_id, client) = setup();
        let owner = Address::generate(&env);
        let auditor_addr = Address::generate(&env);

        register_product(&env, &client, "p1", &owner);
        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp"));

        let attestation = client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, ""),           // product-level attestation
            &auditor_addr,
            &make_str(&env, "att-001"),
            &make_str(&env, "quality_check"),
            &make_str(&env, "deadbeef1234"),
            &make_str(&env, "All checks passed"),
        );

        assert_eq!(attestation.product_id, make_str(&env, "p1"));
        assert_eq!(attestation.auditor, auditor_addr);
        assert_eq!(attestation.attestation_type, make_str(&env, "quality_check"));
    }

    #[test]
    #[should_panic(expected = "auditor not registered")]
    fn test_submit_attestation_unregistered_auditor_panics() {
        let (env, _contract_id, client) = setup();
        let owner = Address::generate(&env);
        let unregistered = Address::generate(&env);

        register_product(&env, &client, "p1", &owner);

        client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, ""),
            &unregistered,
            &make_str(&env, "att-001"),
            &make_str(&env, "quality_check"),
            &make_str(&env, "deadbeef1234"),
            &make_str(&env, ""),
        );
    }

    #[test]
    #[should_panic(expected = "auditor is not active")]
    fn test_submit_attestation_inactive_auditor_panics() {
        let (env, _contract_id, client) = setup();
        let owner = Address::generate(&env);
        let auditor_addr = Address::generate(&env);

        register_product(&env, &client, "p1", &owner);
        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp"));
        client.deactivate_auditor(&auditor_addr);

        client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, ""),
            &auditor_addr,
            &make_str(&env, "att-001"),
            &make_str(&env, "quality_check"),
            &make_str(&env, "deadbeef1234"),
            &make_str(&env, ""),
        );
    }

    #[test]
    #[should_panic(expected = "product not found")]
    fn test_submit_attestation_unknown_product_panics() {
        let (env, _contract_id, client) = setup();
        let auditor_addr = Address::generate(&env);

        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp"));

        client.submit_attestation(
            &make_str(&env, "nonexistent"),
            &make_str(&env, ""),
            &auditor_addr,
            &make_str(&env, "att-001"),
            &make_str(&env, "quality_check"),
            &make_str(&env, "deadbeef1234"),
            &make_str(&env, ""),
        );
    }

    // ── Attestation queries ───────────────────────────────────────────────────

    #[test]
    fn test_get_attestations_returns_all() {
        let (env, _contract_id, client) = setup();
        let owner = Address::generate(&env);
        let auditor_addr = Address::generate(&env);

        register_product(&env, &client, "p1", &owner);
        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp"));

        // Submit two attestations
        client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, ""),
            &auditor_addr,
            &make_str(&env, "att-001"),
            &make_str(&env, "quality_check"),
            &make_str(&env, "sig1"),
            &make_str(&env, "First check"),
        );
        client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, "event-stable-id-abc"),
            &auditor_addr,
            &make_str(&env, "att-002"),
            &make_str(&env, "origin_verified"),
            &make_str(&env, "sig2"),
            &make_str(&env, "Origin confirmed"),
        );

        let attestations = client.get_attestations(&make_str(&env, "p1"));
        assert_eq!(attestations.len(), 2);
    }

    #[test]
    fn test_get_event_attestations_filters_by_target_id() {
        let (env, _contract_id, client) = setup();
        let owner = Address::generate(&env);
        let auditor_addr = Address::generate(&env);

        register_product(&env, &client, "p1", &owner);
        client.register_auditor(&auditor_addr, &make_str(&env, "Acme Auditing Corp"));

        // Product-level attestation
        client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, ""),
            &auditor_addr,
            &make_str(&env, "att-001"),
            &make_str(&env, "quality_check"),
            &make_str(&env, "sig1"),
            &make_str(&env, ""),
        );
        // Event-level attestation
        client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, "event-abc"),
            &auditor_addr,
            &make_str(&env, "att-002"),
            &make_str(&env, "origin_verified"),
            &make_str(&env, "sig2"),
            &make_str(&env, ""),
        );

        let event_attestations = client.get_event_attestations(
            &make_str(&env, "p1"),
            &make_str(&env, "event-abc"),
        );
        assert_eq!(event_attestations.len(), 1);
        assert_eq!(event_attestations.get(0).unwrap().id, make_str(&env, "att-002"));
    }

    #[test]
    fn test_get_attestations_empty_for_unknown_product() {
        let (env, _contract_id, client) = setup();
        // No attestations for a product that doesn't exist yet
        let attestations = client.get_attestations(&make_str(&env, "unknown"));
        assert_eq!(attestations.len(), 0);
    }

    // ── Multiple auditors ─────────────────────────────────────────────────────

    #[test]
    fn test_multiple_auditors_can_attest_same_product() {
        let (env, _contract_id, client) = setup();
        let owner = Address::generate(&env);
        let auditor1 = Address::generate(&env);
        let auditor2 = Address::generate(&env);

        register_product(&env, &client, "p1", &owner);
        client.register_auditor(&auditor1, &make_str(&env, "Auditor One"));
        client.register_auditor(&auditor2, &make_str(&env, "Auditor Two"));

        client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, ""),
            &auditor1,
            &make_str(&env, "att-001"),
            &make_str(&env, "quality_check"),
            &make_str(&env, "sig1"),
            &make_str(&env, ""),
        );
        client.submit_attestation(
            &make_str(&env, "p1"),
            &make_str(&env, ""),
            &auditor2,
            &make_str(&env, "att-002"),
            &make_str(&env, "compliance_verified"),
            &make_str(&env, "sig2"),
            &make_str(&env, ""),
        );

        let attestations = client.get_attestations(&make_str(&env, "p1"));
        assert_eq!(attestations.len(), 2);
        assert_eq!(attestations.get(0).unwrap().auditor, auditor1);
        assert_eq!(attestations.get(1).unwrap().auditor, auditor2);
    }
}

// ── Batch recall tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod batch_recall_tests {
    use crate::{SupplyLinkContract, SupplyLinkContractClient};
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    fn setup() -> (Env, Address, SupplyLinkContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, SupplyLinkContract);
        let client = SupplyLinkContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        (env, owner, client)
    }

    fn make_str(env: &Env, s: &str) -> String {
        String::from_str(env, s)
    }

    fn register_product(
        env: &Env,
        client: &SupplyLinkContractClient,
        product_id: &str,
        owner: &Address,
    ) {
        client.register_product(
            &make_str(env, product_id),
            &make_str(env, "Widget"),
            &make_str(env, "Factory A"),
            owner,
            &1u32,
            &make_str(env, "general"),
            &make_str(env, "other"),
        );
    }

    // ── Batch creation with recall fields ─────────────────────────────────────

    #[test]
    fn test_create_batch_has_recall_defaults() {
        let (env, owner, client) = setup();

        let batch = client.create_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch One"),
            &owner,
        );

        assert!(!batch.recalled);
        assert_eq!(batch.recall_reason, make_str(&env, ""));
        assert_eq!(batch.recall_timestamp, 0u64);
    }

    // ── Batch recall ──────────────────────────────────────────────────────────

    #[test]
    fn test_recall_batch_sets_recalled_flag() {
        let (env, owner, client) = setup();

        client.create_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch One"),
            &owner,
        );

        client.recall_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Contamination found"),
        );

        let (recalled, reason, ts) = client.get_batch_recall_info(&make_str(&env, "batch-001"));
        assert!(recalled);
        assert_eq!(reason, make_str(&env, "Contamination found"));
        assert!(ts > 0);
    }

    #[test]
    fn test_recall_batch_propagates_to_products() {
        let (env, owner, client) = setup();

        // Register two products
        register_product(&env, &client, "p1", &owner);
        register_product(&env, &client, "p2", &owner);

        // Create batch and add products
        client.create_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch One"),
            &owner,
        );
        client.add_product_to_batch(&make_str(&env, "batch-001"), &make_str(&env, "p1"));
        client.add_product_to_batch(&make_str(&env, "batch-001"), &make_str(&env, "p2"));

        // Recall the batch
        let newly_recalled = client.recall_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Safety issue"),
        );

        assert_eq!(newly_recalled, 2u32);

        // Verify both products are recalled
        let p1 = client.get_product(&make_str(&env, "p1")).unwrap();
        let p2 = client.get_product(&make_str(&env, "p2")).unwrap();
        assert!(p1.recalled);
        assert!(p2.recalled);
        assert_eq!(p1.recall_reason, make_str(&env, "Safety issue"));
        assert_eq!(p2.recall_reason, make_str(&env, "Safety issue"));
    }

    #[test]
    fn test_recall_batch_skips_already_recalled_products() {
        let (env, owner, client) = setup();

        register_product(&env, &client, "p1", &owner);
        register_product(&env, &client, "p2", &owner);

        // Pre-recall p1 individually
        client.recall_product(&make_str(&env, "p1"), &make_str(&env, "Pre-existing recall"));

        client.create_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch One"),
            &owner,
        );
        client.add_product_to_batch(&make_str(&env, "batch-001"), &make_str(&env, "p1"));
        client.add_product_to_batch(&make_str(&env, "batch-001"), &make_str(&env, "p2"));

        // Recall the batch — p1 is already recalled, only p2 should be newly recalled
        let newly_recalled = client.recall_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch safety issue"),
        );

        assert_eq!(newly_recalled, 1u32);

        // p1 keeps its original recall reason
        let p1 = client.get_product(&make_str(&env, "p1")).unwrap();
        assert_eq!(p1.recall_reason, make_str(&env, "Pre-existing recall"));

        // p2 gets the batch recall reason
        let p2 = client.get_product(&make_str(&env, "p2")).unwrap();
        assert_eq!(p2.recall_reason, make_str(&env, "Batch safety issue"));
    }

    #[test]
    fn test_recall_batch_empty_batch_returns_zero() {
        let (env, owner, client) = setup();

        client.create_batch(
            &make_str(&env, "batch-empty"),
            &make_str(&env, "Empty Batch"),
            &owner,
        );

        let newly_recalled = client.recall_batch(
            &make_str(&env, "batch-empty"),
            &make_str(&env, "Precautionary recall"),
        );

        assert_eq!(newly_recalled, 0u32);
    }

    #[test]
    fn test_recall_batch_history_accumulates() {
        let (env, owner, client) = setup();

        client.create_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch One"),
            &owner,
        );

        client.recall_batch(&make_str(&env, "batch-001"), &make_str(&env, "Reason 1"));
        client.unrecall_batch(&make_str(&env, "batch-001"));
        client.recall_batch(&make_str(&env, "batch-001"), &make_str(&env, "Reason 2"));

        let history = client.get_batch_recall_history(&make_str(&env, "batch-001"));
        assert_eq!(history.len(), 2);
        assert_eq!(history.get(0).unwrap(), make_str(&env, "Reason 1"));
        assert_eq!(history.get(1).unwrap(), make_str(&env, "Reason 2"));
    }

    #[test]
    fn test_unrecall_batch_clears_flag() {
        let (env, owner, client) = setup();

        client.create_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch One"),
            &owner,
        );
        client.recall_batch(&make_str(&env, "batch-001"), &make_str(&env, "Contamination"));

        let (recalled_before, _, _) = client.get_batch_recall_info(&make_str(&env, "batch-001"));
        assert!(recalled_before);

        client.unrecall_batch(&make_str(&env, "batch-001"));

        let (recalled_after, _, _) = client.get_batch_recall_info(&make_str(&env, "batch-001"));
        assert!(!recalled_after);
    }

    #[test]
    fn test_product_recall_history_updated_on_batch_recall() {
        let (env, owner, client) = setup();

        register_product(&env, &client, "p1", &owner);

        client.create_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch One"),
            &owner,
        );
        client.add_product_to_batch(&make_str(&env, "batch-001"), &make_str(&env, "p1"));

        client.recall_batch(&make_str(&env, "batch-001"), &make_str(&env, "Batch recall reason"));

        let history = client.get_recall_history(&make_str(&env, "p1"));
        assert_eq!(history.len(), 1);
        assert_eq!(history.get(0).unwrap(), make_str(&env, "Batch recall reason"));
    }

    #[test]
    #[should_panic(expected = "batch not found")]
    fn test_recall_nonexistent_batch_panics() {
        let (env, _owner, client) = setup();
        client.recall_batch(&make_str(&env, "nonexistent"), &make_str(&env, "reason"));
    }

    #[test]
    #[should_panic(expected = "recall reason too long")]
    fn test_recall_batch_reason_too_long_panics() {
        let (env, owner, client) = setup();

        client.create_batch(
            &make_str(&env, "batch-001"),
            &make_str(&env, "Batch One"),
            &owner,
        );

        // 257 chars — exceeds 256 limit
        let long_reason = "x".repeat(257);
        client.recall_batch(
            &make_str(&env, "batch-001"),
            &String::from_str(&env, &long_reason),
        );
    }
}
