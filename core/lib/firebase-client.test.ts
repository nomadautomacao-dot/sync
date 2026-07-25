import { describe, it, expect, beforeEach } from "vitest";
import { firebaseClientConfig } from "./firebase-client";

describe("firebaseClientConfig", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "k";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "d";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "p";
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "b";
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "s";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "a";
  });

  it("mapeia as variáveis NEXT_PUBLIC_* para FirebaseOptions", () => {
    expect(firebaseClientConfig()).toEqual({
      apiKey: "k", authDomain: "d", projectId: "p",
      storageBucket: "b", messagingSenderId: "s", appId: "a",
    });
  });

  it("lança se uma variável obrigatória faltar", () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    expect(() => firebaseClientConfig()).toThrow(/NEXT_PUBLIC_FIREBASE_API_KEY/);
  });
});
