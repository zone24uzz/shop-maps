/** A store location as returned by `GET /api/stores`. */
export interface Store {
  _id: string;
  name: string;
  /** Origin of the record, e.g. `demo-seed`. */
  source: string;
  lat: number;
  lng: number;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Result of loading the store list: valid stores plus a count of rejected records. */
export interface StoresResult {
  stores: Store[];
  skippedCount: number;
}
