import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { placeholder: "type here" } };
export const Small: Story = { args: { size: "sm", placeholder: "small" } };
export const Invalid: Story = { args: { invalid: true, defaultValue: "broken" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "locked" } };
