import { render, screen } from "@testing-library/react";
import App from "./App";
import { describe, it, expect } from "vitest";

describe("App", () => {
  it("Renders Title", () => {
    render(<App />);
    expect(screen.getByText("GameSwipe")).toBeInTheDocument();
  });
});
