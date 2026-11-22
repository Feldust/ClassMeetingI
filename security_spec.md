# Security Specification & Payload-First TDD — CKD 76 Class Meeting

## 1. Data Invariants
1. **Master Gate & Role Integrity**: Public visitors can read only `/publicState/current` (`get`, never `list`). Only `isBootstrappedMaster()` (`cassius.steve123@gmail.com`, verified email) or UIDs explicitly listed in `/admins/{uid}` can create or update `/publicState/current`.
2. **AdminPanelConfig Ownership**: Standard admins (`isAdminMember()`) cannot modify `adminPanelConfig`; only `isBootstrappedMaster()` can alter Master-controlled Admin Panel settings.
3. **Zero Self-Promotion**: No user can create, update, or delete records in `/admins/{adminUid}` except `isBootstrappedMaster()`.
4. **Strict Keys & Types**: Shadow/ghost keys on any write are rejected via `hasAll()` + `hasOnly()` + `affectedKeys().hasOnly()`. Every string has `.size()` bounds and arrays have strict max counts.
5. **Temporal Integrity**: `updatedAt` on `/publicState/current` and `createdAt` on `/admins/{adminUid}` must equal `request.time` (server timestamp). `createdAt` and `addedBy` on `/admins/{adminUid}` are immutable after creation.
6. **Path Variable Hardening**: Document IDs must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and `/publicState` strictly restricts single-doc `get`/`create`/`update` to `docId == 'current'`.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write**: Anonymous `setDoc` on `/publicState/current` -> Denied (`request.auth == null`).
2. **Unverified Email Spoofing**: Authenticated token with `cassius.steve123@gmail.com` where `email_verified == false` -> Denied (`isSignedIn()` checks `email_verified == true`).
3. **Collection Scrape (`allow list`)**: `getDocs(collection(db, 'publicState'))` -> Denied (`allow list: if false`).
4. **Admins Enumeration by Non-Master**: `getDocs(collection(db, 'admins'))` as standard user -> Denied (`allow list: if isBootstrappedMaster()`).
5. **Self-Privilege Escalation**: Standard user attempts `setDoc('/admins/' + uid, { role: 'admin', ... })` -> Denied (`isBootstrappedMaster()` required).
6. **Shadow Ghost Field Injection**: Master attempts write to `/publicState/current` with extra `{ isSuperAdmin: true }` key -> Denied (`hasOnly(...)`).
7. **Admin Tampering with Master Config**: Standard admin attempts update to `/publicState/current` changing `adminPanelConfig.allowDeleteItems` -> Denied (`incoming().adminPanelConfig == existing().adminPanelConfig`).
8. **Spoofed `updatedBy` Identity**: Editor sets `updatedBy: "victim-uid"` != `request.auth.uid` -> Denied (`data.updatedBy == request.auth.uid`).
9. **Spoofed Client Timestamp**: Editor submits static timestamp instead of `serverTimestamp()` (`request.time`) -> Denied (`data.updatedAt == request.time`).
10. **Path ID Poisoning**: Attempt `setDoc('/publicState/other_doc', ...)` or 1KB document ID -> Denied (`docId == 'current'` and `isValidId(docId)`).
11. **Denial-of-Wallet Oversized Array**: Editor sends 500 categories (`categories.size() > 50`) or non-map elements -> Denied.
12. **Public State Deletion**: Attempt `deleteDoc('/publicState/current')` -> Denied (`allow delete: if false`).
