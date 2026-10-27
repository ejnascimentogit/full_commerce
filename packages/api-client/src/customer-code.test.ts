import { describe, expect, it } from "vitest";
import { customerNumber } from "./customer-code";

describe("customerNumber", () => {
  it("tira o prefixo CLI-", () => {
    expect(customerNumber("CLI-1001")).toBe("1001");
    expect(customerNumber("cli-1004")).toBe("1004");
  });
  it("mantém um código que já é só número", () => {
    expect(customerNumber("1002")).toBe("1002");
  });
  it("devolve traço quando não há código", () => {
    expect(customerNumber(undefined)).toBe("—");
    expect(customerNumber(null)).toBe("—");
    expect(customerNumber("")).toBe("—");
    expect(customerNumber("CLI-")).toBe("—");
  });
});
