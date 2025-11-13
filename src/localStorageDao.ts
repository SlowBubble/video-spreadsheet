import type { IDao } from './dao';

export const devCollName = 'project';

export class LocalStorageDao implements IDao {
  constructor(public collectionName = devCollName) {}

  private getKey(id: string): string {
    return `${this.collectionName}-${id}`;
  }

  private getAllKeys(): string[] {
    const keys: string[] = [];
    const prefix = `${this.collectionName}-`;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  async getAll() {
    const keys = this.getAllKeys();
    const docs: any[] = [];

    for (const key of keys) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          docs.push(JSON.parse(data));
        }
      } catch (error) {
        console.warn(`Failed to parse data for key: ${key}`, error);
      }
    }
    return docs;
  }

  async get(id: string) {
    const key = this.getKey(id);
    const data = localStorage.getItem(key);
    
    if (data) {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.warn(`Failed to parse data for id: ${id}`, error);
      }
    }
    console.warn('Unable to find doc: ', id);
  }

  async set(id: string, docData: any) {
    const key = this.getKey(id);
    localStorage.setItem(key, JSON.stringify(docData));
  }

  async add(docData: any) {
    // Generate a unique ID if not provided
    const id = docData.id || this.generateId();
    await this.set(id, { ...docData, id });
    return id;
  }

  async delete(id: string): Promise<void> {
    const key = this.getKey(id);
    localStorage.removeItem(key);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
