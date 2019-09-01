/**
 * PG will stores a permanent list of indices received
 */
const keys = require("./keys");

// #### express app setup ####

const express = require("express");
const cors = require("cors");
const PORT = process.env.PORT || 2345;

const app = express();
app.use(cors());
app.use(express.json());

// #### postgres client setup ####

const { Pool } = require("pg");
const pgClient = new Pool({
  user: keys.pgUser,
  password: keys.pgPassword,
  database: keys.pgDatabase,
  host: keys.pgHost,
  port: keys.pgPort
});

pgClient.on("error", () => {
  console.log("Lost PG connection");
});

// initialize the table to store indices
pgClient.query("CREATE TABLE IF NOT EXISTS values (number INT)").catch(err => {
  console.error(err);
});

// #### redis client setup ####

const redis = require("redis");

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

/* redisClient.flushdb( function (err, succeeded) {
  console.log(succeeded); // will be true if successfull
}); */

const redisPublisher = redisClient.duplicate();

// ### express route handlers ###

app.get("/", (req, res) => res.send("working."));
app.get("/values/all", async (req, res) => {
  const indices = await pgClient.query("SELECT * FROM values");
  res.send(indices.rows);
});
app.get("/values/current", async (req, res) => {
  try {
    redisClient.hgetall("values", async (err, values) => {
      res.send(values);
    });
  } catch (err) {
    console.error(err);
  }
});
app.post("/values", async (req, res) => {
  const { index } = req.body;

  //   avoid stack overflow with year long fib compute
  if (+index > 40) {
    res.status(422).send("Index too high");
  }

  redisClient.hset("values", index, "nothing yet");
  //   wake up the worker to calculate fib
  redisPublisher.publish("insert", index);
  //   add the new index
  pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

  res.send({
    computing: true
  });
});

app.listen(PORT, err => {
  console.log(`Listening on port ${PORT}`);
});
