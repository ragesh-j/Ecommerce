import request from "supertest";
import prisma from "../../src/config/db";
import app from "../../src/app";

// clean up after each test
afterEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

// ─── register ─────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/register", () => {
  it("should return 201 on success", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "password123",
        role: "BUYER",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe("john@test.com");
  });

  it("should set refreshToken cookie", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "password123",
        role: "BUYER",
      });

    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("refreshToken");
  });

  it("should return 400 on invalid email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "notanemail",
        password: "password123",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should return 400 on short password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "123",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should return 409 on duplicate email", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "password123",
        role: "BUYER",
      });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "password123",
        role: "BUYER",
      });

    expect(res.status).toBe(409);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "password123",
        role: "BUYER",
      });
  });

  it("should return 200 on valid credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "john@test.com",
        password: "password123",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("should set refreshToken cookie", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "john@test.com",
        password: "password123",
      });

    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("refreshToken");
  });

  it("should return 401 on wrong password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "john@test.com",
        password: "wrongpassword",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return 401 on wrong email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "wrong@test.com",
        password: "password123",
      });

    expect(res.status).toBe(401);
  });
});

// ─── refresh ──────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/refresh", () => {
  it("should return 200 and new accessToken", async () => {
    // register to get cookie
    const registerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "password123",
        role: "BUYER",
      });

    const cookie = registerRes.headers["set-cookie"];

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie); // 👈 send refreshToken cookie

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("should return 401 with no cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/logout", () => {
  it("should return 200 and clear cookie", async () => {
    const registerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "password123",
        role: "BUYER",
      });

    const cookie = registerRes.headers["set-cookie"];

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should delete session from DB", async () => {
    const registerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "John Doe",
        email: "john@test.com",
        password: "password123",
        role: "BUYER",
      });

    const cookie = registerRes.headers["set-cookie"];

    await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie);

    const sessions = await prisma.session.findMany();
    expect(sessions.length).toBe(0);
  });
});