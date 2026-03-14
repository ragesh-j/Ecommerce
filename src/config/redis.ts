import Redis from "ioredis";

const globalForRedis = global as unknown as { redis: Redis };

const createRedisClient = () => {
  const client = new Redis(process.env.REDIS_URL!);

  client.on('connect', () => console.log('Redis connected ✅'));
  client.on('error', (err) => console.error('Redis error ❌', err));

  return client;
};

const redis = globalForRedis.redis || createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export default redis;