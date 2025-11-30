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

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: vi.fn(), success: vi.fn() },
}));

let syncQueue: any;
let getOfflineQueueSize: any;
let getPresets: typeof import("./api/meals").getPresets;
let searchMyFoods: typeof import("./api/foods").searchMyFoods;

beforeEach(async () => {
  vi.resetModules();
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
  (global as any).navigator = { onLine: true } as any;
  (global as any).localStorage = (global as any).window.localStorage;
  (global as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, init?: any) {
      this.type = type;
      this.detail = init?.detail;
    }
  };

  ({ syncQueue, getOfflineQueueSize } = await import("./api/offline"));
  ({ getPresets } = await import("./api/meals"));
  ({ searchMyFoods } = await import("./api/foods"));
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

test("searchMyFoods falls back to cached foods on request failure", async () => {
  const cached = [{ fdcId: 1, description: "Apple", dataType: "Branded" }];
  window.localStorage.setItem(
    "offline-cache",
    JSON.stringify({ foods: cached, foodsTimestamp: Date.now() }),
  );

  axiosInstance.get.mockRejectedValueOnce(new Error("server down"));

  const foods = await searchMyFoods();
  expect(foods).toEqual(cached);
});

test("getPresets returns empty list when offline", async () => {
  (global as any).navigator = { onLine: false } as any;
  const presets = await getPresets();
  expect(presets).toEqual([]);
});

test("getPresets returns empty list on request failure", async () => {
  (global as any).navigator = { onLine: true } as any;
  axiosInstance.get.mockRejectedValueOnce(new Error("server down"));

  const presets = await getPresets();
  expect(presets).toEqual([]);
});
