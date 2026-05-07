import type { Meta, StoryObj } from "@storybook/react-vite";
import { Container } from "./Container";

const meta: Meta<typeof Container> = {
  title: "Layout/Container",
  component: Container,
};
export default meta;

type Story = StoryObj<typeof Container>;

export const Default: Story = {
  render: () => (
    <Container>
      <div className="font-mono text-sm border border-addin-line p-4">
        contained content (max-w-5xl, centered)
      </div>
    </Container>
  ),
};
