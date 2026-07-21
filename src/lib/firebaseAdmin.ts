import {
  type App,
  type Credential,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue as AdminFieldValue,
  getFirestore,
} from "firebase-admin/firestore";
import {
  FieldValue as CloudFieldValue,
  Firestore,
} from "@google-cloud/firestore";
import {
  type AuthClient,
  ExternalAccountClient,
  GoogleAuth,
} from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";

interface VercelIdentity {
  auth: GoogleAuth<AuthClient>;
  credential: Credential;
}

function buildVercelIdentity(): VercelIdentity | null {
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  if (!projectNumber || !serviceAccountEmail || !poolId || !providerId) {
    return null;
  }

  const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  const authClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken(),
    },
  });
  if (!authClient) throw new Error("Could not initialize Vercel OIDC credentials.");

  return {
    auth: new GoogleAuth({
      authClient,
      projectId: process.env.FIREBASE_PROJECT_ID,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    }),
    credential: {
      async getAccessToken() {
        const result = await authClient.getAccessToken();
        if (!result.token) throw new Error("Vercel OIDC token exchange failed.");
        const expiryDate = authClient.credentials.expiry_date;
        const expiresIn = expiryDate
          ? Math.max(1, Math.floor((expiryDate - Date.now()) / 1000))
          : 3000;
        return { access_token: result.token, expires_in: expiresIn };
      },
    },
  };
}

const vercelIdentity = buildVercelIdentity();

function buildAdminApp(identity: VercelIdentity | null): App {
  if (getApps().length) return getApps()[0];

  const usingEmulator =
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);

  if (usingEmulator) {
    return initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "ascent-2026-dev",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n",
  );
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const hasServiceAccount = Boolean(projectId && clientEmail && privateKey);
  return initializeApp({
    credential:
      identity?.credential ??
      (hasServiceAccount
        ? cert({ projectId, clientEmail, privateKey })
        : applicationDefault()),
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const adminApp = buildAdminApp(vercelIdentity);
export const adminAuth = getAuth(adminApp);
export const adminDb = vercelIdentity
  ? new Firestore({
      auth: vercelIdentity.auth,
      databaseId: "(default)",
      preferRest: true,
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  : getFirestore(adminApp);

export function adminServerTimestamp() {
  return vercelIdentity
    ? CloudFieldValue.serverTimestamp()
    : AdminFieldValue.serverTimestamp();
}
