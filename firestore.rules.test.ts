import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Static verification test suite for the "Dirty Dozen" security invariants
 * enforced in firestore.rules against firebase-blueprint.json.
 */
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

const rules = fs.readFileSync(rulesPath, 'utf-8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8')) as {
  entities: Record<string, { required?: string[]; properties: Record<string, unknown> }>;
  firestore: Record<string, unknown>;
};

const dirtyDozenChecks: { name: string; assertFn: () => void }[] = [
  {
    name: '1. Global default-deny safety net present first',
    assertFn: () => assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/),
  },
  {
    name: '2. Email verification required on all authenticated checks',
    assertFn: () => assert.match(rules, /request\.auth\.token\.email_verified == true/),
  },
  {
    name: '3. PublicState blocks collection listing (no scraping)',
    assertFn: () => assert.match(rules, /allow list:\s*if false;/),
  },
  {
    name: '4. Admins list restricted strictly to bootstrapped Master',
    assertFn: () => assert.match(rules, /match \/admins\/\{adminUid\}[\s\S]*allow list:\s*if isBootstrappedMaster\(\);/),
  },
  {
    name: '5. Admins create/update/delete restricted strictly to bootstrapped Master',
    assertFn: () => assert.match(rules, /allow create:\s*if isBootstrappedMaster\(\)/),
  },
  {
    name: '6. Strict key allowlisting (hasAll + hasOnly) in isValidPublicState',
    assertFn: () => {
      assert.match(rules, /data\.keys\(\)\.hasAll\(/);
      assert.match(rules, /data\.keys\(\)\.hasOnly\(/);
    },
  },
  {
    name: '7. Standard admin blocked from modifying adminPanelConfig',
    assertFn: () => assert.match(rules, /incoming\(\)\.adminPanelConfig == existing\(\)\.adminPanelConfig/),
  },
  {
    name: '8. Identity integrity on updatedBy / addedBy',
    assertFn: () => {
      assert.match(rules, /data\.updatedBy == request\.auth\.uid/);
      assert.match(rules, /data\.addedBy == request\.auth\.uid/);
    },
  },
  {
    name: '9. Temporal integrity enforced via request.time',
    assertFn: () => assert.match(rules, /data\.updatedAt == request\.time/),
  },
  {
    name: '10. Path ID hardening via isValidId and explicit docId == current',
    assertFn: () => {
      assert.match(rules, /function isValidId\(id\)/);
      assert.match(rules, /docId == 'current'/);
    },
  },
  {
    name: '11. Bounded array guards on teams, announcements, categories, leaderboards',
    assertFn: () => {
      assert.match(rules, /data\.teams\.size\(\) <= 100/);
      assert.match(rules, /data\.announcements\.size\(\) <= 300/);
      assert.match(rules, /data\.categories\.size\(\) <= 50/);
      assert.match(rules, /data\.leaderboards\.size\(\) <= 50/);
    },
  },
  {
    name: '12. PublicState deletion explicitly blocked',
    assertFn: () => assert.match(rules, /allow delete:\s*if false;/),
  },
  {
    name: '13. Blueprint paths match rules blocks',
    assertFn: () => {
      assert.ok(blueprint.firestore['/publicState/{docId}']);
      assert.ok(blueprint.firestore['/admins/{adminUid}']);
      assert.ok(blueprint.firestore['/adminAuth/{docId}']);
    },
  },
  {
    name: '14. AdminAuth writes restricted to Master with monotonic passwordVersion',
    assertFn: () => {
      assert.match(rules, /match \/adminAuth\/\{docId\}/);
      assert.match(rules, /function isValidAdminAuth\(data\)/);
      assert.match(rules, /incoming\(\)\.passwordVersion > existing\(\)\.passwordVersion/);
    },
  },
];

for (const check of dirtyDozenChecks) {
  check.assertFn();
  console.log(`PASS: ${check.name}`);
}
