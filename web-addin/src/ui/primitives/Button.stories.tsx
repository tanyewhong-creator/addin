import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary", children: "save" } };
export const Secondary: Story = { args: { variant: "secondary", children: "cancel" } };
export const Ghost: Story = { args: { variant: "ghost", children: "details" } };
export const Danger: Story = { args: { intent: "danger", children: "delete" } };
export const Loading: Story = { args: { loading: true, children: "saving" } };
