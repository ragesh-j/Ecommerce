import prisma from "../../src/config/db";
import { register } from "../../src/modules/auth/auth.service";
import {
  getProfile,
  updateProfile,
  changePassword,
  setPassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
} from "../../src/modules/user/user.service";

// clean up after each test
afterEach(async () => {
  await prisma.session.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
});

// helper — register and return userId
const createUser = async (overrides = {}) => {
  const result = await register({
    name: "John Doe",
    email: "john@test.com",
    password: "password123",
    role: "BUYER",
    ...overrides,
  });
  return result.user.id;
};

const addressData = {
  line1: "123 Main St",
  city: "New York",
  postalCode: "10001",
  country: "US",
  isDefault: true,
};

// ─── getProfile ───────────────────────────────────────────────────────────────
describe("getProfile", () => {
  it("should return user profile", async () => {
    const userId = await createUser();
    const profile = await getProfile(userId);

    expect(profile.email).toBe("john@test.com");
    expect(profile.name).toBe("John Doe");
    expect(profile.role).toBe("BUYER");
  });

  it("should throw 404 for non-existent user", async () => {
    await expect(getProfile("non-existent-id")).rejects.toThrow("User not found");
  });
});

// ─── updateProfile ────────────────────────────────────────────────────────────
describe("updateProfile", () => {
  it("should update user name", async () => {
    const userId = await createUser();
    const updated = await updateProfile(userId, { name: "Updated Name" });
    expect(updated.name).toBe("Updated Name");
  });

  it("should not change other fields", async () => {
    const userId = await createUser();
    const updated = await updateProfile(userId, { name: "Updated Name" });
    expect(updated.email).toBe("john@test.com");
    expect(updated.role).toBe("BUYER");
  });
});

// ─── changePassword ───────────────────────────────────────────────────────────
describe("changePassword", () => {
  it("should change password successfully", async () => {
    const userId = await createUser();
    await expect(
      changePassword(userId, { currentPassword: "password123", newPassword: "newpassword123" })
    ).resolves.not.toThrow();
  });

  it("should throw 401 on wrong current password", async () => {
    const userId = await createUser();
    await expect(
      changePassword(userId, { currentPassword: "wrongpassword", newPassword: "newpassword123" })
    ).rejects.toThrow("Current password is incorrect");
  });

  it("should throw 400 if new password is same as current", async () => {
    const userId = await createUser();
    await expect(
      changePassword(userId, { currentPassword: "password123", newPassword: "password123" })
    ).rejects.toThrow("New password must be different");
  });

  it("should throw 400 if user has no password (google user)", async () => {
    // create user without password (simulate google user)
    const user = await prisma.user.create({
      data: { email: "google@test.com", name: "Google User", role: "BUYER" },
    });
    await expect(
      changePassword(user.id, { currentPassword: "", newPassword: "newpassword123" })
    ).rejects.toThrow("No password set");
  });
});

// ─── setPassword ──────────────────────────────────────────────────────────────
describe("setPassword", () => {
  it("should set password for google user", async () => {
    const user = await prisma.user.create({
      data: { email: "google@test.com", name: "Google User", role: "BUYER" },
    });
    await expect(
      setPassword(user.id, { newPassword: "newpassword123" })
    ).resolves.not.toThrow();

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.passwordHash).not.toBeNull();
  });

  it("should throw 400 if password already set", async () => {
    const userId = await createUser();
    await expect(
      setPassword(userId, { newPassword: "newpassword123" })
    ).rejects.toThrow("Password already set");
  });
});

// ─── addresses ────────────────────────────────────────────────────────────────
describe("addAddress", () => {
  it("should add an address", async () => {
    const userId = await createUser();
    const address = await addAddress(userId, addressData);
    expect(address.line1).toBe("123 Main St");
    expect(address.isDefault).toBe(true);
  });

  it("should only keep one default address", async () => {
    const userId = await createUser();
    await addAddress(userId, { ...addressData, isDefault: true });
    await addAddress(userId, { ...addressData, line1: "456 Other St", isDefault: true });

    const addresses = await getAddresses(userId);
    const defaults = addresses.filter(a => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].line1).toBe("456 Other St"); // second one is default
  });
});

describe("updateAddress", () => {
  it("should update an address", async () => {
    const userId = await createUser();
    const address = await addAddress(userId, addressData);
    const updated = await updateAddress(userId, address.id, { city: "Los Angeles" });
    expect(updated.city).toBe("Los Angeles");
  });

  it("should throw 403 if address belongs to another user", async () => {
    const userId1 = await createUser({ email: "user1@test.com" });
    const userId2 = await createUser({ email: "user2@test.com" });

    const address = await addAddress(userId1, addressData);
    await expect(
      updateAddress(userId2, address.id, { city: "Los Angeles" })
    ).rejects.toThrow("Forbidden");
  });

  it("should throw 404 for non-existent address", async () => {
    const userId = await createUser();
    await expect(
      updateAddress(userId, "non-existent-id", { city: "LA" })
    ).rejects.toThrow("Address not found");
  });
});

describe("deleteAddress", () => {
  it("should delete an address", async () => {
    const userId = await createUser();
    const address = await addAddress(userId, addressData);
    await deleteAddress(userId, address.id);

    const addresses = await getAddresses(userId);
    expect(addresses).toHaveLength(0);
  });

  it("should throw 403 if address belongs to another user", async () => {
    const userId1 = await createUser({ email: "user1@test.com" });
    const userId2 = await createUser({ email: "user2@test.com" });

    const address = await addAddress(userId1, addressData);
    await expect(
      deleteAddress(userId2, address.id)
    ).rejects.toThrow("Forbidden");
  });
});