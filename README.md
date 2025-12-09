# LLM Graph

A chat application with graph-based question visualization, built with Next.js and TypeScript.

## Features

- **Graph-based Chat**: Drag arrows from chat responses to ask questions in response to specific context
- **Visual Question Graph**: Visualize the graph of questions without polluting context
- **Modern UI**: Clean, responsive design with dark/light mode support

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Theme**: next-themes for dark/light mode
- **Font**: Inter (Google Fonts)

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Building for Production

1. Generate a production build:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Project Structure

```
llm-graph/
├── app/
│   ├── globals.css      # Global styles and theme
│   ├── layout.tsx       # Root layout with theme provider
│   └── page.tsx         # Home page
├── public/              # Static assets
└── ...config files
```

## Future Development

This application will be extended to include:
- Chat interface with LLM integration
- Drag-and-drop arrow functionality (Zapier-like UI)
- Graph visualization of question relationships
- Context management for graph-based conversations
