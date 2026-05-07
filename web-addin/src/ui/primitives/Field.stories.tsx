import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "./Field";
import { Input } from "./Input";

const meta: Meta<typeof Field> = {
  title: "Primitives/Field",
  component: Field,
};
export default meta;

type Story = StoryObj<typeof Field>;

export const WithHelp: Story = {
  args: { label: "name", help: "your full name" },
  render: (args) => (
    <Field {...args}>
      <Input />
    </Field>
  ),
};

export const WithError: Story = {
  args: { label: "email", error: "must be a valid email" },
  render: (args) => (
    <Field {...args}>
      <Input defaultValue="not-an-email" />
    </Field>
  ),
};

export const Required: Story = {
  args: { label: "key", required: true },
  render: (args) => (
    <Field {...args}>
      <Input />
    </Field>
  ),
};
