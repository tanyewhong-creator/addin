import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageHeader } from "./PageHeader";
import { Button } from "../primitives/Button";

const meta: Meta<typeof PageHeader> = {
  title: "Composites/PageHeader",
  component: PageHeader,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: { title: "audit", subtitle: "ten most recent decisions" },
};

export const WithActions: Story = {
  args: {
    title: "skills",
    subtitle: "what addin can do",
    actions: <Button variant="secondary">new skill</Button>,
  },
};
