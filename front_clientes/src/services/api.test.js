import { describe, it, expect, beforeEach } from "vitest";
import {
  getClientToken,
  saveClientSession,
  clearClientSession,
} from "./api.js";

describe("services/api session helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("guarda sesion persistente cuando remember=true", () => {
    const empleado = { id: 7, nombre: "Ana" };

    saveClientSession({ token: "token-permanente", empleado }, true);

    expect(localStorage.getItem("token")).toBe("token-permanente");
    expect(localStorage.getItem("empleado")).toBe(JSON.stringify(empleado));
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("empleado")).toBeNull();
    expect(getClientToken()).toBe("token-permanente");
  });

  it("guarda sesion temporal cuando remember=false", () => {
    const empleado = { id: 9, nombre: "Luis" };

    saveClientSession({ token: "token-temporal", empleado }, false);

    expect(sessionStorage.getItem("token")).toBe("token-temporal");
    expect(sessionStorage.getItem("empleado")).toBe(JSON.stringify(empleado));
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("empleado")).toBeNull();
    expect(getClientToken()).toBe("token-temporal");
  });

  it("limpia sesion en ambos storages", () => {
    localStorage.setItem("token", "abc");
    localStorage.setItem("empleado", '{"id":1}');
    sessionStorage.setItem("token", "def");
    sessionStorage.setItem("empleado", '{"id":2}');

    clearClientSession();

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("empleado")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("empleado")).toBeNull();
    expect(getClientToken()).toBeNull();
  });
});
