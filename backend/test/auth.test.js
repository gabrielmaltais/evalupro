const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/User");

let mongod;

test.before(async () => {
  process.env.JWT_SECRET = "test-secret";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  await User.deleteMany({});
});

test("register puis login", async () => {
  const reg = await request(app).post("/api/auth/register").send({
    name: "Test User",
    email: "test@example.com",
    password: "Password123!",
  });
  assert.equal(reg.statusCode, 201);
  assert.ok(reg.body.token);

  const login = await request(app).post("/api/auth/login").send({
    email: "test@example.com",
    password: "Password123!",
  });
  assert.equal(login.statusCode, 200);
  assert.ok(login.body.token);
});

test("mise a jour du profil (PUT /me)", async () => {
  const reg = await request(app).post("/api/auth/register").send({
    name: "Alice",
    email: "alice@example.com",
    password: "Password123!",
  });
  assert.equal(reg.statusCode, 201);
  const token = reg.body.token;

  const upd = await request(app)
    .put("/api/auth/me")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Alice Martin",
      email: "alice@example.com",
      currentPassword: "Password123!",
      newPassword: "NewPassword456!",
    });
  assert.equal(upd.statusCode, 200);
  assert.ok(upd.body.token);
  assert.equal(upd.body.user.name, "Alice Martin");

  const login2 = await request(app).post("/api/auth/login").send({
    email: "alice@example.com",
    password: "NewPassword456!",
  });
  assert.equal(login2.statusCode, 200);
});
