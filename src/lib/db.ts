import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hearthly_dev";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { _hearthlyMongo?: Cache };
const cache: Cache = g._hearthlyMongo ?? (g._hearthlyMongo = { conn: null, promise: null });

/** One shared connection per process. A failed attempt is NOT cached, so the next request retries. */
export async function dbConnect(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  cache.promise ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, bufferCommands: false, maxPoolSize: 10 });
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null; // don't cache a failed connection; retry on the next request
    throw e;
  }
  return cache.conn;
}
