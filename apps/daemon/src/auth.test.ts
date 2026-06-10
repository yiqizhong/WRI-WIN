import { describe, it, expect } from "vitest";
import { isRequestAuthorized, isHostAllowed, isOriginAllowed } from "./auth";

const TOKEN = "tok-123";
const PORT = 47631;

describe("isHostAllowed", () => {
  it("accepts loopback host with the daemon port", () => {
    expect(isHostAllowed("127.0.0.1:47631", PORT)).toBe(true);
    expect(isHostAllowed("localhost:47631", PORT)).toBe(true);
  });
  it("rejects a rebinding host", () => {
    expect(isHostAllowed("attacker.com", PORT)).toBe(false);
    expect(isHostAllowed("127.0.0.1:80", PORT)).toBe(false);
    expect(isHostAllowed(undefined, PORT)).toBe(false);
  });
});

describe("isOriginAllowed", () => {
  it("accepts no Origin and loopback origins", () => {
    expect(isOriginAllowed(undefined, PORT)).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:5173", PORT)).toBe(true);
    expect(isOriginAllowed("http://localhost:47631", PORT)).toBe(true);
  });
  it("rejects a foreign Origin", () => {
    expect(isOriginAllowed("https://evil.example", PORT)).toBe(false);
  });
});

describe("isRequestAuthorized", () => {
  it("accepts a matching bearer token", () => {
    expect(isRequestAuthorized({ authorization: `Bearer ${TOKEN}` }, "/agents", TOKEN)).toBe(true);
  });
  it("accepts a matching ?token= query", () => {
    expect(isRequestAuthorized({}, `/sessions/x/screenshots/y?token=${TOKEN}`, TOKEN)).toBe(true);
  });
  it("rejects a missing/wrong token", () => {
    expect(isRequestAuthorized({}, "/agents", TOKEN)).toBe(false);
    expect(isRequestAuthorized({ authorization: "Bearer nope" }, "/agents", TOKEN)).toBe(false);
  });
  it("always allows /health unauthenticated", () => {
    expect(isRequestAuthorized({}, "/health", TOKEN)).toBe(true);
  });
});
