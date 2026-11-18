# Security Specification — Los Cerberos Firestore

## 1. Data Invariants
1. **Master Gate & Membership**: All reads and writes to `/cartels/{cartelId}/state/{stateId}` require a verified authenticated user (`request.auth.token.email_verified == true`) who is either a bootstrapped admin (`s.voirin63@gmail.com` / `/admins/{uid}`) or has an existing membership record at `/cartels/{cartelId}/members/{uid}`.
2. **Editor Authorization**: All writes to `/cartels/{cartelId}/state/{stateId}` require either `isAdmin()` or a member document with `role == 'editor'`.
3. **Secret Code Protection**: `/cartels/{cartelId}/private/auth` holds the `secretCode` and can never be read by `viewer` users or listed. Upgrading a member's `role` from `'viewer'` to `'editor'` is rejected unless `incoming().accessCode == get(.../private/auth).data.secretCode` (or `isAdmin()`).
4. **No Blanket List Queries**: All `allow list` rules are explicitly `false` — clients subscribe only to known singleton document paths via `onSnapshot(doc(...))`.
5. **PII Isolation**: Member documents store only `uid`, `displayName`, `role`, `accessCode`, `joinedAt`, `updatedAt` (no emails, phones, or addresses) and can only be read by `request.auth.uid == memberId || isAdmin()`.
6. **Temporal & Identity Integrity**: Every write enforces `updatedAt == request.time`, `updatedBy == request.auth.uid` (or `uid == request.auth.uid`), and `createdAt`/`joinedAt` immutability on updates.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read of `/cartels/los_cerberos/state/missions`.
2. Unverified email user attempting to create `/cartels/los_cerberos/members/{uid}`.
3. Viewer user attempting to directly update `/cartels/los_cerberos/state/missions`.
4. Viewer user attempting to self-escalate to `role: 'editor'` with an invalid `accessCode: 'WRONG'`.
5. Viewer user attempting to read `/cartels/los_cerberos/private/auth` to steal `secretCode`.
6. User attempting a `list` query on `/cartels/los_cerberos/members` or `/cartels/los_cerberos/state`.
7. Editor attempting to inject a shadow field (`isAdmin: true`) into `/cartels/los_cerberos/state/treasury`.
8. Editor attempting to spoof `updatedBy: 'another_uid'` on `/cartels/los_cerberos/state/inventory`.
9. Editor attempting to inject a fake client timestamp (`updatedAt: '2020-01-01'`) instead of `request.time`.
10. Member attempting to overwrite another user's `/cartels/los_cerberos/members/{otherUid}` document.
11. User attempting to inject a 1MB junk string into `cartelId` or `displayName`.
12. Editor attempting to set negative `legal: -500` or `weaponsLossAmount: -100` in `/cartels/los_cerberos/state/treasury`.
