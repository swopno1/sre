import { SRE } from '@smythos/sre';
import { Agent } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsPath = path.resolve(__dirname, './models.json');

// We initialize SRE with custom settings of the JSON ModelsProvider,
// in order to load our additional models that use the Custom connector.
SRE.init({
    ModelsProvider: {
        Connector: 'JSONModelsProvider',
        Settings: {
            models: modelsPath,
            mode: 'merge', // preserve smyth predefined models and add my custom models on top of them
        },
    },
});

async function main() {
    // This agent will use the custom model defined in models.json
    const agent = new Agent({
        id: 'local-model-assistant',
        name: 'Local Model Assistant',
        behavior: 'You are an assistant powered by a local AI model.',
        model: 'my-local-model', // This model name must match the one in models.json
    });

    console.log('Using local model:', agent.defaultModel.modelId);

    // Note: This example will only work if you have a local AI server running
    // that is compatible with the OpenAI API and is serving the specified model.
    // For example, you can use Ollama to serve the phi-3-mini-instruct-Q4_K_M.gguf model.
    try {
        const promptResult = await agent.prompt('Write a function that returns the sum of two numbers');
        console.log(promptResult);
    } catch (error) {
        console.error('Error while prompting the local model:');
        console.error('Please make sure you have a local AI server running at http://localhost:8080/v1');
        //console.error(error);
    }
}

main();
