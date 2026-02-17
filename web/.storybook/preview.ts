import type { Preview } from '@storybook/nextjs-vite'
import { createElement } from 'react'
import { TooltipProvider } from '../src/components/ui/tooltip'
import '../src/app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
  decorators: [
    (Story) => createElement(TooltipProvider, null, createElement(Story)),
  ],
};

export default preview;
