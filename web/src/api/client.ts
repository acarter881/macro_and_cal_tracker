import axios from "axios";

const origin = typeof window !== "undefined" ? window.location.origin : "";
const inferredBase =
  import.meta.env.VITE_API_BASE_URL ||
  (origin && !origin.includes("5173") ? origin : "http://localhost:8000");

export const api = axios.create({
  baseURL: `${inferredBase}/api`,
});

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const configAuthToken = import.meta.env.VITE_CONFIG_AUTH_TOKEN;
export const configHeaders = configAuthToken
  ? { "X-Config-Token": configAuthToken }
  : undefined;
