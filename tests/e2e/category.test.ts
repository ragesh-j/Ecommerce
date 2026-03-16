import request from "supertest";
import prisma from "../../src/config/db";
import app from "../../src/app";

afterEach(async () => {
  await prisma.category.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

// ─── helpers ──────────────────────────────────────────────────────────────────
const registerAdmin = async () => {
  // create admin user directly in DB since register only allows BUYER/SELLER
  const { hashPassword } = await import("../../src/utils/hash");
  const { generateAccessToken } = await import("../../src/utils/token");

  const user = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@test.com",
      passwordHash: await hashPassword("password123"),
      role: "ADMIN",
    },
  });

  const accessToken = generateAccessToken(user.id, user.role);
  return { accessToken, user };
};

const registerBuyer = async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Buyer", email: "buyer@test.com", password: "password123", role: "BUYER" });
  return { accessToken: res.body.data.accessToken };
};

const createCategory = async (accessToken: string, data = {}) => {
  return request(app)
    .post("/api/v1/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Electronics", slug: "electronics", ...data });
};

// ─── GET /categories ──────────────────────────────────────────────────────────
describe("GET /api/v1/categories", () => {
  it("should return all categories publicly", async () => {
    const { accessToken } = await registerAdmin();
    await createCategory(accessToken);

    const res = await request(app).get("/api/v1/categories");

    expect(res.status).toBe(200);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.data.categories[0].name).toBe("Electronics");
  });

  it("should return tree structure with children", async () => {
    const { accessToken } = await registerAdmin();
    const parentRes = await createCategory(accessToken);
    const parentId = parentRes.body.data.category.id;

    await createCategory(accessToken, { name: "Phones", slug: "phones", parentId });

    const res = await request(app).get("/api/v1/categories");

    expect(res.body.data.categories).toHaveLength(1); // only Electronics at top
    expect(res.body.data.categories[0].children).toHaveLength(1); // Phones inside
  });
});

// ─── GET /categories/:slug ────────────────────────────────────────────────────
describe("GET /api/v1/categories/:slug", () => {
  it("should return category by slug", async () => {
    const { accessToken } = await registerAdmin();
    await createCategory(accessToken);

    const res = await request(app).get("/api/v1/categories/electronics");

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe("Electronics");
  });

  it("should return 404 for non-existent slug", async () => {
    const res = await request(app).get("/api/v1/categories/non-existent");
    expect(res.status).toBe(404);
  });
});

// ─── POST /categories ─────────────────────────────────────────────────────────
describe("POST /api/v1/categories", () => {
  it("should create category as admin", async () => {
    const { accessToken } = await registerAdmin();
    const res = await createCategory(accessToken);

    expect(res.status).toBe(201);
    expect(res.body.data.category.name).toBe("Electronics");
  });

  it("should return 403 if not admin", async () => {
    const { accessToken } = await registerBuyer();
    const res = await createCategory(accessToken);

    expect(res.status).toBe(403);
  });

  it("should return 401 if not authenticated", async () => {
    const res = await request(app)
      .post("/api/v1/categories")
      .send({ name: "Electronics", slug: "electronics" });

    expect(res.status).toBe(401);
  });

  it("should return 400 if slug has invalid characters", async () => {
    const { accessToken } = await registerAdmin();
    const res = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Electronics", slug: "Electronics 123!" });

    expect(res.status).toBe(400);
  });
});

// ─── PUT /categories/:id ──────────────────────────────────────────────────────
describe("PUT /api/v1/categories/:id", () => {
  it("should update category as admin", async () => {
    const { accessToken } = await registerAdmin();
    const createRes = await createCategory(accessToken);
    const id = createRes.body.data.category.id;

    const res = await request(app)
      .put(`/api/v1/categories/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Electronics" });

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe("Updated Electronics");
  });

  it("should return 403 if not admin", async () => {
    const { accessToken: adminToken } = await registerAdmin();
    const { accessToken: buyerToken } = await registerBuyer();
    const createRes = await createCategory(adminToken);
    const id = createRes.body.data.category.id;

    const res = await request(app)
      .put(`/api/v1/categories/${id}`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ name: "Updated" });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /categories/:id ───────────────────────────────────────────────────
describe("DELETE /api/v1/categories/:id", () => {
  it("should delete category as admin", async () => {
    const { accessToken } = await registerAdmin();
    const createRes = await createCategory(accessToken);
    const id = createRes.body.data.category.id;

    const res = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it("should return 400 if category has subcategories", async () => {
    const { accessToken } = await registerAdmin();
    const parentRes = await createCategory(accessToken);
    const parentId = parentRes.body.data.category.id;

    await createCategory(accessToken, { name: "Phones", slug: "phones", parentId });

    const res = await request(app)
      .delete(`/api/v1/categories/${parentId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it("should return 403 if not admin", async () => {
    const { accessToken: adminToken } = await registerAdmin();
    const { accessToken: buyerToken } = await registerBuyer();
    const createRes = await createCategory(adminToken);
    const id = createRes.body.data.category.id;

    const res = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(403);
  });
});