import "../src/styles/global.css";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    backgrounds: { default: "light" },
    layout: "centered",
  },
};

export default preview;
