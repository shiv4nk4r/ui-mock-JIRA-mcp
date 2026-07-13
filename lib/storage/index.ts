import { LocalStorageRepository } from "./local-storage";
import { FirestoreRepository } from "./firestore-repository";
import { isFirebaseEnabled } from "@lib/firebase/config";

export type { IRepository } from "./repository";
export { LocalStorageRepository, generateId } from "./local-storage";

export const repository = isFirebaseEnabled()
  ? new FirestoreRepository()
  : new LocalStorageRepository();
