import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  getDocsFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { AppDataState } from './types';

export const MASTER_EMAIL = 'cassius.steve123@gmail.com';
export const PUBLIC_STATE_COLLECTION = 'publicState';
export const PUBLIC_STATE_DOC_ID = 'current';
export const ADMINS_COLLECTION = 'admins';
export const ADMIN_AUTH_COLLECTION = 'adminAuth';
export const ADMIN_AUTH_DOC_ID = 'current';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export function isBootstrappedMasterUser(user: User | null): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email &&
      user.email.toLowerCase() === MASTER_EMAIL
  );
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function checkIsCloudAuthorized(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (isBootstrappedMasterUser(user)) return true;

  const adminDocPath = `${ADMINS_COLLECTION}/${user.uid}`;
  try {
    const snap = await getDocFromServer(doc(db, ADMINS_COLLECTION, user.uid));
    return snap.exists();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
      return false;
    }
    handleFirestoreError(error, OperationType.GET, adminDocPath);
  }
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        result[k] = stripUndefinedDeep(v);
      }
    }
    return result as T;
  }
  return value;
}

export async function publishPublicStateToFirestore(
  state: AppDataState
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Google authentication is required to sync changes across devices.');
  }

  const docPath = `${PUBLIC_STATE_COLLECTION}/${PUBLIC_STATE_DOC_ID}`;
  const stateRef = doc(db, PUBLIC_STATE_COLLECTION, PUBLIC_STATE_DOC_ID);
  const cleanState = stripUndefinedDeep(state);
  const isMaster = isBootstrappedMasterUser(currentUser);

  let effectiveAdminPanelConfig = cleanState.adminPanelConfig;
  let existed = false;
  try {
    const existingSnap = await getDocFromServer(stateRef);
    if (existingSnap.exists()) {
      existed = true;
      const existingData = existingSnap.data();
      if (!isMaster && existingData && existingData.adminPanelConfig) {
        effectiveAdminPanelConfig = existingData.adminPanelConfig;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  const payload = {
    banner: cleanState.banner,
    siteCopy: cleanState.siteCopy,
    adminPanelConfig: effectiveAdminPanelConfig,
    teams: cleanState.teams,
    announcements: cleanState.announcements,
    categories: cleanState.categories,
    leaderboards: cleanState.leaderboards,
    lastUpdated: cleanState.lastUpdated || new Date().toISOString(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  };

  try {
    await setDoc(stateRef, payload);
  } catch (error) {
    handleFirestoreError(error, existed ? OperationType.UPDATE : OperationType.CREATE, docPath);
  }
}

export interface CloudAdminRecord {
  uid: string;
  role: 'admin';
  label: string;
  addedBy: string;
}

export async function listCloudAdmins(): Promise<CloudAdminRecord[]> {
  try {
    const snap = await getDocsFromServer(collection(db, ADMINS_COLLECTION));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        role: 'admin',
        label: typeof data.label === 'string' ? data.label : 'Committee Admin',
        addedBy: typeof data.addedBy === 'string' ? data.addedBy : '',
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ADMINS_COLLECTION);
  }
}

export async function addCloudAdmin(uid: string, label: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Master Google sign-in required.');
  }
  const cleanUid = uid.trim();
  const cleanLabel = label.trim() || 'Committee Admin';
  const docPath = `${ADMINS_COLLECTION}/${cleanUid}`;
  try {
    await setDoc(doc(db, ADMINS_COLLECTION, cleanUid), {
      role: 'admin',
      label: cleanLabel.slice(0, 100),
      addedBy: currentUser.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function removeCloudAdmin(uid: string): Promise<void> {
  const cleanUid = uid.trim();
  const docPath = `${ADMINS_COLLECTION}/${cleanUid}`;
  try {
    await deleteDoc(doc(db, ADMINS_COLLECTION, cleanUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function publishAdminAuthToFirestore(
  authEnvelope: string,
  passwordVersion: number
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !isBootstrappedMasterUser(currentUser)) {
    throw new Error('Master Google sign-in (cassius.steve123@gmail.com) is required.');
  }
  const docPath = `${ADMIN_AUTH_COLLECTION}/${ADMIN_AUTH_DOC_ID}`;
  const authRef = doc(db, ADMIN_AUTH_COLLECTION, ADMIN_AUTH_DOC_ID);
  let existed = false;
  try {
    const snap = await getDocFromServer(authRef);
    existed = snap.exists();
  } catch {
    existed = false;
  }

  try {
    await setDoc(authRef, {
      authEnvelope,
      passwordVersion,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    });
  } catch (error) {
    handleFirestoreError(error, existed ? OperationType.UPDATE : OperationType.CREATE, docPath);
  }
}
