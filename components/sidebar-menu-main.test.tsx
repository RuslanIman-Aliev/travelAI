import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SidebarMenuMain } from "@/components/sidebar-menu-main";

const mockSetTheme = jest.fn();
const mockUsePathname = jest.fn();
const mockUseTheme = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock("@/components/ui/sidebar", () => {
  const React = require("react");

  return {
    SidebarMenu: ({ children, ...props }: any) => (
      <ul {...props}>{children}</ul>
    ),
    SidebarMenuItem: ({ children, ...props }: any) => (
      <li {...props}>{children}</li>
    ),
    SidebarMenuButton: ({ children, asChild, isActive, ...props }: any) => {
      const buttonProps = {
        "data-active": isActive ? "true" : "false",
        ...props,
      };

      if (asChild) {
        const child = React.Children.only(children);
        return React.cloneElement(child, {
          ...buttonProps,
          ...child.props,
        });
      }

      return <button {...buttonProps}>{children}</button>;
    },
  };
});

describe("SidebarMenuMain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/");
    mockUseTheme.mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
    });
  });

  it("renders all main navigation links", () => {
    render(<SidebarMenuMain />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Trip" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Live Guide" }),
    ).toBeInTheDocument();
  });

  it("marks matching route as active", () => {
    mockUsePathname.mockReturnValue("/new-trip");

    render(<SidebarMenuMain />);

    expect(screen.getByRole("link", { name: "New Trip" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("toggles dark theme to light theme", async () => {
    mockUseTheme.mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
    });

    render(<SidebarMenuMain />);

    await waitFor(() => {
      expect(screen.getByText("Light Mode")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /light mode/i }));

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
