import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "./password";

export type Restaurant = {
  id: string;
  name: string;
  city: string;
  createdAt: Date;
};

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  restaurantId: string;
  createdAt: Date;
};

export type Session = {
  id: string;
  userId: string;
  expiresAt: Date;
};

type Store = {
  restaurants: Map<string, Restaurant>;
  users: Map<string, User>;
  sessions: Map<string, Session>;
};

// Keep a single store across hot reloads in development.
const globalForStore = globalThis as unknown as { tabloStore?: Promise<Store> };

async function createStore(): Promise<Store> {
  const store: Store = {
    restaurants: new Map(),
    users: new Map(),
    sessions: new Map(),
  };

  const restaurant: Restaurant = {
    id: randomUUID(),
    name: "Le Comptoir",
    city: "Lyon",
    createdAt: new Date(),
  };
  store.restaurants.set(restaurant.id, restaurant);

  const demoUser: User = {
    id: randomUUID(),
    name: "Camille Martin",
    email: "demo@tablo.example",
    passwordHash: await hashPassword("demo1234"),
    restaurantId: restaurant.id,
    createdAt: new Date(),
  };
  store.users.set(demoUser.id, demoUser);

  return store;
}

function getStore(): Promise<Store> {
  globalForStore.tabloStore ??= createStore();
  return globalForStore.tabloStore;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const store = await getStore();
  const wanted = normalizeEmail(email);
  for (const user of store.users.values()) {
    if (user.email === wanted) return user;
  }
  return undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const store = await getStore();
  return store.users.get(id);
}

export async function findRestaurantById(id: string): Promise<Restaurant | undefined> {
  const store = await getStore();
  return store.restaurants.get(id);
}

export async function countUsersInRestaurant(restaurantId: string): Promise<number> {
  const store = await getStore();
  let count = 0;
  for (const user of store.users.values()) {
    if (user.restaurantId === restaurantId) count += 1;
  }
  return count;
}

export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
  restaurantName: string;
  city: string;
}): Promise<User> {
  const store = await getStore();

  const restaurant: Restaurant = {
    id: randomUUID(),
    name: input.restaurantName,
    city: input.city,
    createdAt: new Date(),
  };
  store.restaurants.set(restaurant.id, restaurant);

  const user: User = {
    id: randomUUID(),
    name: input.name,
    email: normalizeEmail(input.email),
    passwordHash: await hashPassword(input.password),
    restaurantId: restaurant.id,
    createdAt: new Date(),
  };
  store.users.set(user.id, user);

  return user;
}

export async function createSession(userId: string, ttlMs: number): Promise<Session> {
  const store = await getStore();
  const session: Session = {
    id: randomBytes(32).toString("hex"),
    userId,
    expiresAt: new Date(Date.now() + ttlMs),
  };
  store.sessions.set(session.id, session);
  return session;
}

export async function findSession(id: string): Promise<Session | undefined> {
  const store = await getStore();
  const session = store.sessions.get(id);
  if (!session) return undefined;
  if (session.expiresAt.getTime() <= Date.now()) {
    store.sessions.delete(id);
    return undefined;
  }
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  const store = await getStore();
  store.sessions.delete(id);
}
