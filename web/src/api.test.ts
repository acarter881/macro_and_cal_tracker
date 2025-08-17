import { beforeEach, expect, test, vi } from "vitest";

const postMock = vi.fn();
const axiosInstance = {
  post: postMock,
  delete: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
};
vi.mock("axios", () => ({
  default: { create: () => axiosInstance },
}));

let syncQueue: any;
let getOfflineQueueSize: any;

beforeEach(async () => {
  postMock.mockReset();
  axiosInstance.delete.mockReset();
  axiosInstance.patch.mockReset();
  axiosInstance.put.mockReset();
  axiosInstance.get.mockReset();

  const store: Record<string, string> = {};
  (global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const key in store) delete store[key];
      },
    },
    dispatchEvent: vi.fn(),
    location: { origin: "http://localhost" },
  } as any;
  (global as any).localStorage = (global as any).window.localStorage;
  (global as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, init?: any) {
      this.type = type;
      this.detail = init?.detail;
    }
  };

  const mod = await import("./api/offline");
  syncQueue = mod.syncQueue;
  getOfflineQueueSize = mod.getOfflineQueueSize;
});

test("failed API call requeues operation and preserves queue length", async () => {
  const initialStore = {
    days: {},
    dayTimestamps: {},
    foods: [],
    foodsTimestamp: 0,
    weights: {},
    weightTimestamps: {},
    queue: [
      { kind: "createMeal", payload: { date: "2024-01-01", tempId: -1 } },
    ],
    nextId: -1,
  };
  window.localStorage.setItem("offline-cache", JSON.stringify(initialStore));

  postMock.mockRejectedValueOnce(new Error("network"));

  expect(getOfflineQueueSize()).toBe(1);
  await syncQueue();
  expect(getOfflineQueueSize()).toBe(1);
  const saved = JSON.parse(window.localStorage.getItem("offline-cache")!);
  expect(saved.queue[0]).toEqual(initialStore.queue[0]);
});
