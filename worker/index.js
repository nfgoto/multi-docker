/**
 * watches redis for new indices
 * pulles each new index
 * calculates new value then puts it back into redis
 */

const keys = require("./keys");
const redis = require("redis");

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000 // every 1s
});

// redis subscription
const sub = redisClient.duplicate();

function fib(index) {
  if (index < 2) {
    return 1;
  }

  return fib(index - 1) + fib(index - 2);
}

// on new message compute fib for index
sub.on("message", (channel, message) => {
  console.log("@@@@@ received message from REDIS", message);

  // update "values" hashSet with fib result
  redisClient.hset("values", message, fib(+message), redis.print);
});

sub.subscribe("insert");
