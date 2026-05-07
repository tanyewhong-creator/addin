import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "./Icon";
import { Search, Check, AlertTriangle } from "./allowlist";

const meta: Meta<typeof Icon> = {
  title: "Primitives/Icon",
  component: Icon,
};
export default meta;

type Story = StoryObj<typeof Icon>;

export const SearchIcon: Story = { args: { icon: Search, size: 16 } };
export const CheckIcon: Story = { args: { icon: Check, size: 20 } };
export const Warning: Story = { args: { icon: AlertTriangle, size: 24 } };
