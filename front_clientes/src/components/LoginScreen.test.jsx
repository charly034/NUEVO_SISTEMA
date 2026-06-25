import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginScreen from "./LoginScreen.jsx";

describe("LoginScreen", () => {
  it("envia credenciales recortando espacios y remember por defecto", async () => {
    const onLogin = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();

    render(<LoginScreen onLogin={onLogin} />);

    await user.type(screen.getByLabelText(/email/i), "  test@empresa.com  ");
    await user.type(
      screen.getByLabelText(/contrase\u00f1a/i, { selector: "input" }),
      "secreto123",
    );
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(onLogin).toHaveBeenCalledWith(
      "test@empresa.com",
      "secreto123",
      true,
    );
  });

  it("muestra error cuando onLogin falla", async () => {
    const onLogin = vi
      .fn()
      .mockRejectedValue(new Error("credenciales invalidas"));
    const user = userEvent.setup();

    render(<LoginScreen onLogin={onLogin} />);

    await user.type(screen.getByLabelText(/email/i), "test@empresa.com");
    await user.type(
      screen.getByLabelText(/contrase\u00f1a/i, { selector: "input" }),
      "mal",
    );
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "credenciales invalidas",
    );
  });
});
