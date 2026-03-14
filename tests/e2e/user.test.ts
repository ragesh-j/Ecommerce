import request from "supertest";
import prisma from "../../src/config/db";
import app from "../../src/app";

afterEach(async () => {
  await prisma.session.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
});

// helper
const registerAndLogin = async (overrides = {}) => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      role: "BUYER",
      ...overrides,
    });
  return {
    accessToken: res.body.data.accessToken,
    cookie: res.headers["set-cookie"],
    user: res.body.data.user,
  };
};

const addressData = {
  line1: "123 Main St",
  city: "New York",
  postalCode: "10001",
  country: "US",
  isDefault: true,
};

// ─── GET /users/me ─────────────────────────────────────────────────────────────
describe("GET /api/v1/users/me", () => {
  it("should return profile", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("john@test.com");
  });

  it("should return 401 with no token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
  });

  it("should return 401 with invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer invalidtoken");
    expect(res.status).toBe(401);
  });
});

// ─── PUT /users/me ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/users/me", () => {
  it("should update name", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .put("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe("Updated Name");
  });

  it("should return 400 if name is too short", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .put("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "A" });

    expect(res.status).toBe(400);
  });
});

// ─── PUT /users/me/password ────────────────────────────────────────────────────
describe("PUT /api/v1/users/me/password", () => {
  it("should change password", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .put("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "password123", newPassword: "newpassword123" });

    expect(res.status).toBe(200);
  });

  it("should return 401 on wrong current password", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .put("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "wrongpassword", newPassword: "newpassword123" });

    expect(res.status).toBe(401);
  });

  it("should return 400 if same password", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .put("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "password123", newPassword: "password123" });

    expect(res.status).toBe(400);
  });
});

// ─── POST /users/me/password ───────────────────────────────────────────────────
describe("POST /api/v1/users/me/password", () => {
  it("should set password for google user", async () => {
    // create google user directly in DB
    const user = await prisma.user.create({
      data: { email: "google@test.com", name: "Google User", role: "BUYER" },
    });

    // create session manually to get accessToken
    const { generateAccessToken } = await import("../../src/utils/token");
    const accessToken = generateAccessToken(user.id, user.role);

    const res = await request(app)
      .post("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ newPassword: "newpassword123" });

    expect(res.status).toBe(200);
  });

  it("should return 400 if password already set", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ newPassword: "newpassword123" });

    expect(res.status).toBe(400);
  });
});

// ─── addresses ─────────────────────────────────────────────────────────────────
describe("Addresses", () => {
  it("should add an address", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(addressData);

    expect(res.status).toBe(201);
    expect(res.body.data.address.line1).toBe("123 Main St");
  });

  it("should get all addresses", async () => {
    const { accessToken } = await registerAndLogin();
    await request(app)
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(addressData);

    const res = await request(app)
      .get("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.addresses).toHaveLength(1);
  });

  it("should update an address", async () => {
    const { accessToken } = await registerAndLogin();
    const addRes = await request(app)
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(addressData);

    const id = addRes.body.data.address.id;
    const res = await request(app)
      .put(`/api/v1/users/me/addresses/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ city: "Los Angeles" });

    expect(res.status).toBe(200);
    expect(res.body.data.address.city).toBe("Los Angeles");
  });

  it("should delete an address", async () => {
    const { accessToken } = await registerAndLogin();
    const addRes = await request(app)
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(addressData);

    const id = addRes.body.data.address.id;
    const res = await request(app)
      .delete(`/api/v1/users/me/addresses/${id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it("should return 403 when accessing another user's address", async () => {
    const { accessToken: token1 } = await registerAndLogin({ email: "user1@test.com" });
    const { accessToken: token2 } = await registerAndLogin({ email: "user2@test.com" });

    const addRes = await request(app)
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${token1}`)
      .send(addressData);

    const id = addRes.body.data.address.id;
    const res = await request(app)
      .delete(`/api/v1/users/me/addresses/${id}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(403);
  });

  it("should only have one default address", async () => {
    const { accessToken } = await registerAndLogin();
    await request(app)
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...addressData, isDefault: true });

    await request(app)
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...addressData, line1: "456 Other St", isDefault: true });

    const res = await request(app)
      .get("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${accessToken}`);

    const defaults = res.body.data.addresses.filter((a: any) => a.isDefault);
    expect(defaults).toHaveLength(1);
  });
});