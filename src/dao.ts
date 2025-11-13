// Common interface for data access objects
export interface IDao {
  collectionName: string;
  getAll(): Promise<any[]>;
  get(id: string): Promise<any | undefined>;
  set(id: string, docData: any): Promise<void>;
  add(docData: any): Promise<string>;
  delete(id: string): Promise<void>;
}
