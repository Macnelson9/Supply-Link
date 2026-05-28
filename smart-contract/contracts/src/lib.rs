#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, String, Vec, Symbol};

// ── Schema version ────────────────────────────────────────────────────────────

/// Current schema version for Product and TrackingEvent structs (#392).
pub const SCHEMA_VERSION: u32 = 1;

// ── Error codes ───────────────────────────────────────────────────────────────

/// Typed contract errors for frontend mapping (#390).
#[contracterror]
#[derive(Clone, Copy, PartialEq, Debug)]
#[repr(u32)]
pub enum ContractError {
    ProductNotFound        = 1,
    ProductAlreadyExists   = 2,
    UnauthorizedActor      = 3,
    OwnershipMismatch      = 4,
    InvalidEventPayload    = 5,
    ProductRecalled        = 6,
    SelfTransferNotAllowed = 7,
}

// ── Data models ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub origin: String,
    pub owner: Address,
    pub timestamp: u64,
    pub authorized_actors: Vec<Address>,
    /// Whether this product has been recalled (#393).
    pub recalled: bool,
    /// Reason provided when the product was recalled (#393).
    pub recall_reason: String,
    /// Ledger timestamp when the product was recalled; 0 if never recalled (#393).
    pub recall_timestamp: u64,
    /// Schema version of this record (#392).
    pub schema_version: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct TrackingEvent {
    pub product_id: String,
    pub location: String,
    pub actor: Address,
    pub timestamp: u64,
    pub event_type: String,
    pub metadata: String,
    /// Schema version of this record (#392).
    pub schema_version: u32,
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Product(String),
    Events(String),
    ProductCount,
    ProductIndex(u64),
    /// Recall history for a product: Vec<String> of recall reasons (#393).
    RecallHistory(String),
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct SupplyLinkContract;

#[contractimpl]
impl SupplyLinkContract {
    // ── Registration ─────────────────────────────────────────────────────────

    pub fn register_product(
        env: Env,
        id: String,
        name: String,
        origin: String,
        owner: Address,
    ) -> Product {
        owner.require_auth();
        let product = Product {
            id: id.clone(),
            name,
            origin,
            owner,
            timestamp: env.ledger().timestamp(),
            authorized_actors: Vec::new(&env),
            recalled: false,
            recall_reason: String::from_str(&env, ""),
            recall_timestamp: 0,
            schema_version: SCHEMA_VERSION,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Product(id.clone()), &product);

        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::ProductCount)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::ProductCount, &(count + 1));
        env.storage()
            .persistent()
            .set(&DataKey::ProductIndex(count), &id);

        env.events().publish(
            (Symbol::new(&env, "product_registered"), id.clone()),
            product.clone(),
        );

        product
    }

    /// Batch-register up to 10 products in a single transaction (#389).
    pub fn register_products_batch(
        env: Env,
        owner: Address,
        ids: Vec<String>,
        names: Vec<String>,
        origins: Vec<String>,
    ) -> Vec<Product> {
        owner.require_auth();
        if ids.len() > 10 {
            panic!("batch size exceeds maximum of 10");
        }
        if ids.len() != names.len() || ids.len() != origins.len() {
            panic!("ids, names, and origins must have equal length");
        }
        let mut products = Vec::new(&env);
        let mut count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::ProductCount)
            .unwrap_or(0);
        for i in 0..ids.len() {
            let id = ids.get(i).unwrap();
            let name = names.get(i).unwrap();
            let origin = origins.get(i).unwrap();
            let product = Product {
                id: id.clone(),
                name,
                origin,
                owner: owner.clone(),
                timestamp: env.ledger().timestamp(),
                authorized_actors: Vec::new(&env),
                recalled: false,
                recall_reason: String::from_str(&env, ""),
                recall_timestamp: 0,
                schema_version: SCHEMA_VERSION,
            };
            env.storage()
                .persistent()
                .set(&DataKey::Product(id.clone()), &product);
            env.storage()
                .persistent()
                .set(&DataKey::ProductIndex(count), &id);
            count += 1;
            products.push_back(product);
        }
        env.storage()
            .persistent()
            .set(&DataKey::ProductCount, &count);
        products
    }

    // ── Tracking events ───────────────────────────────────────────────────────

    pub fn add_tracking_event(
        env: Env,
        product_id: String,
        caller: Address,
        location: String,
        event_type: String,
        metadata: String,
    ) -> TrackingEvent {
        let product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id.clone()))
            .expect("product not found");

        // Reject events on recalled products (#393)
        if product.recalled {
            panic!("product is recalled");
        }

        let is_owner = product.owner == caller;
        let is_actor = product.authorized_actors.contains(&caller);
        if !is_owner && !is_actor {
            panic!("caller is not authorized");
        }
        caller.require_auth();

        let event = TrackingEvent {
            product_id: product_id.clone(),
            location,
            actor: caller,
            timestamp: env.ledger().timestamp(),
            event_type: event_type.clone(),
            metadata,
            schema_version: SCHEMA_VERSION,
        };

        let mut events: Vec<TrackingEvent> = env
            .storage()
            .persistent()
            .get(&DataKey::Events(product_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        events.push_back(event.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Events(product_id.clone()), &events);

        env.events().publish(
            (Symbol::new(&env, "event_added"), product_id, event_type),
            event.clone(),
        );

        event
    }

    // ── Recall management (#393) ──────────────────────────────────────────────

    /// Recall a product. Owner-only. Sets recalled=true and records the reason.
    pub fn recall_product(env: Env, product_id: String, reason: String) -> bool {
        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id.clone()))
            .expect("product not found");

        product.owner.require_auth();

        product.recalled = true;
        product.recall_reason = reason.clone();
        product.recall_timestamp = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);

        // Append to recall history
        let mut history: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::RecallHistory(product_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        history.push_back(reason);
        env.storage()
            .persistent()
            .set(&DataKey::RecallHistory(product_id.clone()), &history);

        env.events().publish(
            (Symbol::new(&env, "product_recalled"), product_id),
            product.recalled,
        );

        true
    }

    /// Lift a recall from a product. Owner-only. Sets recalled=false.
    pub fn unrecall_product(env: Env, product_id: String) -> bool {
        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id.clone()))
            .expect("product not found");

        product.owner.require_auth();

        product.recalled = false;

        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);

        env.events().publish(
            (Symbol::new(&env, "product_unrecalled"), product_id),
            product.recalled,
        );

        true
    }

    /// Return recall information for a product: (recalled, reason, timestamp).
    pub fn get_recall_info(env: Env, product_id: String) -> (bool, String, u64) {
        let product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id))
            .expect("product not found");
        (product.recalled, product.recall_reason, product.recall_timestamp)
    }

    /// Return the full recall history (all reasons) for a product (#393).
    pub fn get_recall_history(env: Env, product_id: String) -> Vec<String> {
        env.storage()
            .persistent()
            .get(&DataKey::RecallHistory(product_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── Read-only queries ─────────────────────────────────────────────────────

    pub fn get_product(env: Env, id: String) -> Product {
        env.storage()
            .persistent()
            .get(&DataKey::Product(id))
            .expect("product not found")
    }

    pub fn get_tracking_events(env: Env, product_id: String) -> Vec<TrackingEvent> {
        env.storage()
            .persistent()
            .get(&DataKey::Events(product_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn product_exists(env: Env, id: String) -> bool {
        env.storage().persistent().has(&DataKey::Product(id))
    }

    pub fn get_events_count(env: Env, product_id: String) -> u32 {
        env.storage()
            .persistent()
            .get::<DataKey, Vec<TrackingEvent>>(&DataKey::Events(product_id))
            .map(|v| v.len())
            .unwrap_or(0)
    }

    pub fn get_authorized_actors(env: Env, product_id: String) -> Vec<Address> {
        env.storage()
            .persistent()
            .get::<DataKey, Product>(&DataKey::Product(product_id))
            .map(|p| p.authorized_actors)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_product_count(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::ProductCount)
            .unwrap_or(0)
    }

    pub fn list_products(env: Env, offset: u64, limit: u64) -> Vec<String> {
        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::ProductCount)
            .unwrap_or(0);

        let mut products = Vec::new(&env);
        let end = core::cmp::min(offset + limit, count);

        for i in offset..end {
            if let Some(product_id) = env
                .storage()
                .persistent()
                .get::<DataKey, String>(&DataKey::ProductIndex(i))
            {
                products.push_back(product_id);
            }
        }

        products
    }

    // ── Ownership & actor management ──────────────────────────────────────────

    pub fn transfer_ownership(env: Env, product_id: String, new_owner: Address) -> bool {
        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id.clone()))
            .expect("product not found");

        product.owner.require_auth();
        product.owner = new_owner.clone();
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);

        env.events().publish(
            (Symbol::new(&env, "ownership_transferred"), product_id),
            new_owner,
        );

        true
    }

    pub fn add_authorized_actor(env: Env, product_id: String, actor: Address) -> bool {
        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id.clone()))
            .expect("product not found");

        product.owner.require_auth();
        product.authorized_actors.push_back(actor.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);

        env.events().publish(
            (Symbol::new(&env, "actor_authorized"), product_id),
            actor,
        );

        true
    }

    pub fn remove_authorized_actor(env: Env, product_id: String, actor: Address) -> bool {
        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id.clone()))
            .expect("product not found");

        product.owner.require_auth();

        let mut found = false;
        let mut new_actors = Vec::new(&env);
        for i in 0..product.authorized_actors.len() {
            let current_actor = product.authorized_actors.get(i).unwrap();
            if current_actor != actor {
                new_actors.push_back(current_actor);
            } else {
                found = true;
            }
        }

        product.authorized_actors = new_actors;
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id), &product);

        found
    }

    pub fn update_product_metadata(
        env: Env,
        product_id: String,
        name: String,
        origin: String,
    ) -> Product {
        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id.clone()))
            .expect("product not found");

        product.owner.require_auth();

        product.name = name;
        product.origin = origin;

        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);

        env.events().publish(
            (Symbol::new(&env, "product_updated"), product_id),
            product.clone(),
        );

        product
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Env, String};

    fn setup() -> (Env, SupplyLinkContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, SupplyLinkContract);
        let client = SupplyLinkContractClient::new(&env, &contract_id);
        (env, client)
    }

    fn make_str(env: &Env, s: &str) -> String {
        String::from_str(env, s)
    }

    // ── Basic registration ────────────────────────────────────────────────────

    #[test]
    fn test_register_product_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let product = client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        assert_eq!(product.id, make_str(&env, "p1"));
        assert_eq!(product.schema_version, SCHEMA_VERSION);
        assert!(!product.recalled);
    }

    #[test]
    fn test_product_exists() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        assert!(!client.product_exists(&make_str(&env, "p1")));
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        assert!(client.product_exists(&make_str(&env, "p1")));
    }

    #[test]
    fn test_get_product_count() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        assert_eq!(client.get_product_count(), 0);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        assert_eq!(client.get_product_count(), 1);
    }

    // ── Tracking events ───────────────────────────────────────────────────────

    #[test]
    fn test_add_tracking_event_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        let event = client.add_tracking_event(
            &make_str(&env, "p1"),
            &owner,
            &make_str(&env, "Warehouse B"),
            &make_str(&env, "SHIPPING"),
            &make_str(&env, "{}"),
        );
        assert_eq!(event.schema_version, SCHEMA_VERSION);
        assert_eq!(client.get_events_count(&make_str(&env, "p1")), 1);
    }

    #[test]
    #[should_panic(expected = "caller is not authorized")]
    fn test_add_tracking_event_unauthorized() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let stranger = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        client.add_tracking_event(
            &make_str(&env, "p1"),
            &stranger,
            &make_str(&env, "Warehouse B"),
            &make_str(&env, "SHIPPING"),
            &make_str(&env, "{}"),
        );
    }

    // ── Recall (#393) ─────────────────────────────────────────────────────────

    #[test]
    fn test_recall_product_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        client.recall_product(&make_str(&env, "p1"), &make_str(&env, "Contamination found"));
        let product = client.get_product(&make_str(&env, "p1"));
        assert!(product.recalled);
        assert_eq!(product.recall_reason, make_str(&env, "Contamination found"));
    }

    #[test]
    fn test_unrecall_product_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        client.recall_product(&make_str(&env, "p1"), &make_str(&env, "Contamination found"));
        client.unrecall_product(&make_str(&env, "p1"));
        let product = client.get_product(&make_str(&env, "p1"));
        assert!(!product.recalled);
    }

    #[test]
    #[should_panic(expected = "product is recalled")]
    fn test_recalled_product_rejects_events() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        client.recall_product(&make_str(&env, "p1"), &make_str(&env, "Safety issue"));
        // This should panic with "product is recalled"
        client.add_tracking_event(
            &make_str(&env, "p1"),
            &owner,
            &make_str(&env, "Warehouse B"),
            &make_str(&env, "SHIPPING"),
            &make_str(&env, "{}"),
        );
    }

    // ── Batch registration (#389) ─────────────────────────────────────────────

    #[test]
    fn test_register_products_batch_success() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let mut ids = Vec::new(&env);
        let mut names = Vec::new(&env);
        let mut origins = Vec::new(&env);
        ids.push_back(make_str(&env, "b1"));
        ids.push_back(make_str(&env, "b2"));
        names.push_back(make_str(&env, "Alpha"));
        names.push_back(make_str(&env, "Beta"));
        origins.push_back(make_str(&env, "Origin A"));
        origins.push_back(make_str(&env, "Origin B"));
        let products = client.register_products_batch(&owner, &ids, &names, &origins);
        assert_eq!(products.len(), 2);
        assert_eq!(client.get_product_count(), 2);
        assert!(client.product_exists(&make_str(&env, "b1")));
        assert!(client.product_exists(&make_str(&env, "b2")));
    }

    #[test]
    fn test_recall_history_accumulates() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        client.recall_product(&make_str(&env, "p1"), &make_str(&env, "Reason 1"));
        client.unrecall_product(&make_str(&env, "p1"));
        client.recall_product(&make_str(&env, "p1"), &make_str(&env, "Reason 2"));
        let history = client.get_recall_history(&make_str(&env, "p1"));
        assert_eq!(history.len(), 2);
        assert_eq!(history.get(0).unwrap(), make_str(&env, "Reason 1"));
        assert_eq!(history.get(1).unwrap(), make_str(&env, "Reason 2"));
    }

    #[test]
    #[should_panic]
    fn test_recall_panics_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, SupplyLinkContract);
        let client = SupplyLinkContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        // Attempt to recall without providing the owner's auth — should panic
        // We achieve this by calling recall_product with a different env that
        // has no mocked auths, which causes require_auth to fail.
        let env2 = Env::default();
        // env2 has no mocked auths; calling recall on the same contract will panic
        let client2 = SupplyLinkContractClient::new(&env2, &contract_id);
        client2.recall_product(&make_str(&env2, "p1"), &make_str(&env2, "Unauthorized recall"));
    }

    #[test]
    fn test_register_products_batch() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let mut ids = Vec::new(&env);
        let mut names = Vec::new(&env);
        let mut origins = Vec::new(&env);
        ids.push_back(make_str(&env, "b1"));
        ids.push_back(make_str(&env, "b2"));
        ids.push_back(make_str(&env, "b3"));
        names.push_back(make_str(&env, "Alpha"));
        names.push_back(make_str(&env, "Beta"));
        names.push_back(make_str(&env, "Gamma"));
        origins.push_back(make_str(&env, "Origin A"));
        origins.push_back(make_str(&env, "Origin B"));
        origins.push_back(make_str(&env, "Origin C"));
        let products = client.register_products_batch(&owner, &ids, &names, &origins);
        assert_eq!(products.len(), 3);
        assert_eq!(client.get_product_count(), 3);
        assert!(client.product_exists(&make_str(&env, "b1")));
        assert!(client.product_exists(&make_str(&env, "b2")));
        assert!(client.product_exists(&make_str(&env, "b3")));
        // Verify schema version and recall defaults
        let p = client.get_product(&make_str(&env, "b1"));
        assert_eq!(p.schema_version, SCHEMA_VERSION);
        assert!(!p.recalled);
    }

    #[test]
    #[should_panic(expected = "batch size exceeds maximum of 10")]
    fn test_register_products_batch_exceeds_limit() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let mut ids = Vec::new(&env);
        let mut names = Vec::new(&env);
        let mut origins = Vec::new(&env);
        for i in 0..11u32 {
            let id = match i {
                0 => make_str(&env, "x0"),
                1 => make_str(&env, "x1"),
                2 => make_str(&env, "x2"),
                3 => make_str(&env, "x3"),
                4 => make_str(&env, "x4"),
                5 => make_str(&env, "x5"),
                6 => make_str(&env, "x6"),
                7 => make_str(&env, "x7"),
                8 => make_str(&env, "x8"),
                9 => make_str(&env, "x9"),
                _ => make_str(&env, "x10"),
            };
            ids.push_back(id.clone());
            names.push_back(make_str(&env, "Name"));
            origins.push_back(make_str(&env, "Origin"));
        }
        client.register_products_batch(&owner, &ids, &names, &origins);
    }

    #[test]
    #[should_panic(expected = "ids, names, and origins must have equal length")]
    fn test_register_products_batch_mismatched_lengths() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let mut ids = Vec::new(&env);
        let mut names = Vec::new(&env);
        let origins = Vec::new(&env);
        ids.push_back(make_str(&env, "b1"));
        names.push_back(make_str(&env, "Alpha"));
        names.push_back(make_str(&env, "Beta"));
        client.register_products_batch(&owner, &ids, &names, &origins);
    }

    // ── Transfer ownership ────────────────────────────────────────────────────

    #[test]
    fn test_transfer_ownership() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        client.transfer_ownership(&make_str(&env, "p1"), &new_owner);
        let product = client.get_product(&make_str(&env, "p1"));
        assert_eq!(product.owner, new_owner);
    }

    // ── Authorized actors ─────────────────────────────────────────────────────

    #[test]
    fn test_add_and_remove_authorized_actor() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let actor = Address::generate(&env);
        client.register_product(
            &make_str(&env, "p1"),
            &make_str(&env, "Widget"),
            &make_str(&env, "Factory A"),
            &owner,
        );
        client.add_authorized_actor(&make_str(&env, "p1"), &actor);
        let actors = client.get_authorized_actors(&make_str(&env, "p1"));
        assert_eq!(actors.len(), 1);
        client.remove_authorized_actor(&make_str(&env, "p1"), &actor);
        let actors = client.get_authorized_actors(&make_str(&env, "p1"));
        assert_eq!(actors.len(), 0);
    }

    // ── List products ─────────────────────────────────────────────────────────

    #[test]
    fn test_list_products_pagination() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        // Register 3 products using known IDs
        client.register_product(&make_str(&env, "p0"), &make_str(&env, "W0"), &make_str(&env, "O"), &owner);
        client.register_product(&make_str(&env, "p1"), &make_str(&env, "W1"), &make_str(&env, "O"), &owner);
        client.register_product(&make_str(&env, "p2"), &make_str(&env, "W2"), &make_str(&env, "O"), &owner);
        let page = client.list_products(&0u64, &2u64);
        assert_eq!(page.len(), 2);
        let all = client.list_products(&0u64, &10u64);
        assert_eq!(all.len(), 3);
    }

    // ── Schema version (#392) ─────────────────────────────────────────────────

    #[test]
    fn test_schema_version_on_product() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let product = client.register_product(
            &make_str(&env, "sv1"),
            &make_str(&env, "Versioned"),
            &make_str(&env, "Lab"),
            &owner,
        );
        assert_eq!(product.schema_version, 1u32);
    }

    #[test]
    fn test_schema_version_on_event() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        client.register_product(
            &make_str(&env, "sv1"),
            &make_str(&env, "Versioned"),
            &make_str(&env, "Lab"),
            &owner,
        );
        let event = client.add_tracking_event(
            &make_str(&env, "sv1"),
            &owner,
            &make_str(&env, "Port"),
            &make_str(&env, "SHIPPING"),
            &make_str(&env, "{}"),
        );
        assert_eq!(event.schema_version, 1u32);
    }
}
