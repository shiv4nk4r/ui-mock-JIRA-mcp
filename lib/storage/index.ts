import { LocalStorageRepository } from "./local-storage";

export type { IRepository } from "./repository";
export { LocalStorageRepository, generateId } from "./local-storage";

export const repository = new LocalStorageRepository();
