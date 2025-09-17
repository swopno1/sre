# SmythOS SRE Examples

This directory contains a collection of examples demonstrating how to use the SmythOS SRE (Smyth Runtime Environment) and its various features.

Each example is a standalone script that can be run to see a specific part of the system in action.

## Running Examples

You can run any example using `npm`, `pnpm`, or `yarn`. Simply provide the path to the example file you want to run.

### With NPM

```bash
npm start <path_to_example.ts>
```

### With PNPM

```bash
pnpm start <path_to_example.ts>
```

### With Yarn

```bash
yarn start <path_to_example.ts>
```

For instance, to run an example located at `01-agent-code-skill/01-prompting.ts`, you would execute:

```bash
npm start ./01-agent-code-skill/01-prompting.ts
```

---

### 11. Custom LLM Connector

This example demonstrates how to use the `Custom` LLM connector to connect to a local AI model that exposes an OpenAI-compatible API.

-   **`11-custom-llm-connector/01-custom-llm-connector.ts`**: Shows how to configure and use the `Custom` connector with a local model.
-   **`11-custom-llm-connector/models.json`**: An example `models.json` file that defines a model using the `Custom` connector.

To run this example, you will need to have a local AI server running, such as Ollama or a `llama.cpp` server.
