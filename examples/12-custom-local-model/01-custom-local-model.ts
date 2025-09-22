import { SRE } from '@smythos/sre';
import { Agent } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsPath = path.resolve(__dirname, './models.json');

//We initialize SRE with custom settings of the JSON ModelsProvider, in order to load our additional models
SRE.init({
    ModelsProvider: {
        Connector: 'JSONModelsProvider',
        Settings: {
            models: modelsPath,
            mode: 'merge', //preserve smyth predefined models and add my custom models on top of them
        },
    },
});

async function main() {
    const agent = new Agent({
        id: 'local-llama-assistant',

        name: 'Local Llama Assistant',
        behavior: 'You are a helpful assistant.',
        model: 'local-llama',
    });


    const promptResult = await agent.prompt('Hello, who won the World Cup in 2022?');

    console.log(promptResult);


}

main();
