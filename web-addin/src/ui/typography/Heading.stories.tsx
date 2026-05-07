import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heading } from "./Heading";

const meta: Meta<typeof Heading> = {
  title: "Typography/Heading",
  component: Heading,
};
export default meta;

type Story = StoryObj<typeof Heading>;

export const H1: Story = { args: { level: 1, children: "heading one" } };
export const H2: Story = { args: { level: 2, children: "heading two" } };
export const H3: Story = { args: { level: 3, children: "heading three" } };
export const H4: Story = { args: { level: 4, children: "heading four" } };
