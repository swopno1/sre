import { Agent, Model } from '@smythos/sdk';
import { SRE } from '@smythos/sre';

/**
 * Example demonstrating Weaviate VectorDB Connector usage
 * This example shows how to use the new Weaviate connector with SmythOS SRE
 */
async function demonstrateWeaviateConnector() {
    console.log('🚀 Starting Weaviate VectorDB Connector Demo');
    
    try {
        // Initialize SRE with Weaviate connector
        SRE.init({
            VectorDB: {
                Connector: 'Weaviate',
                Settings: {
                    url: process.env.WEAVIATE_URL || 'http://localhost:8080',
                    apiKey: process.env.WEAVIATE_API_KEY, // Optional
                    className: 'SmythVector',
                    embeddings: {
                        provider: 'OpenAI',
                        model: 'text-embedding-3-small',
                        params: {
                            dimensions: 1536
                        }
                    }
                }
            }
        });

        await SRE.ready();
        console.log('✅ SRE initialized with Weaviate connector');

        // Create an agent that uses Weaviate
        const agent = new Agent({
            id: 'weaviate-demo-agent',
            name: 'Document Search Agent',
            model: Model.OpenAI('gpt-4o'),
            behavior: 'You are a helpful document search assistant that can find relevant information using vector search.'
        });

        // Access Weaviate through the agent
        const vectorDB = agent.vectorDB.Weaviate('demo-documents');

        console.log('📚 Creating document namespace...');
        await vectorDB.createNamespace('demo-documents', {
            description: 'Demo documents for Weaviate connector testing'
        });

        console.log('📝 Adding sample documents...');
        
        // Add some sample documents
        const documents = [
            {
                text: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data.',
                metadata: { category: 'AI', topic: 'machine-learning', difficulty: 'beginner' }
            },
            {
                text: 'Deep learning uses neural networks with multiple layers to process complex patterns in data.',
                metadata: { category: 'AI', topic: 'deep-learning', difficulty: 'intermediate' }
            },
            {
                text: 'Natural language processing enables computers to understand and generate human language.',
                metadata: { category: 'AI', topic: 'nlp', difficulty: 'intermediate' }
            },
            {
                text: 'Computer vision allows machines to interpret and understand visual information from images.',
                metadata: { category: 'AI', topic: 'computer-vision', difficulty: 'intermediate' }
            }
        ];

        // Create datasources for each document
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            await vectorDB.createDatasource('demo-documents', {
                text: doc.text,
                metadata: doc.metadata,
                label: `Document ${i + 1}`,
                id: `doc-${i + 1}`
            });
        }

        console.log('🔍 Performing vector search...');
        
        // Search for similar documents
        const searchQueries = [
            'What is artificial intelligence?',
            'How do neural networks work?',
            'Tell me about image processing'
        ];

        for (const query of searchQueries) {
            console.log(`\n🔎 Searching for: "${query}"`);
            
            const results = await vectorDB.search(query, {
                topK: 3,
                includeMetadata: true
            });

            console.log(`📊 Found ${results.matches.length} relevant documents:`);
            results.matches.forEach((match, index) => {
                console.log(`  ${index + 1}. Score: ${match.score?.toFixed(3)}`);
                console.log(`     Content: ${match.metadata?.content?.substring(0, 100)}...`);
                console.log(`     Category: ${match.metadata?.category}, Topic: ${match.metadata?.topic}`);
            });
        }

        console.log('\n📋 Listing all datasources...');
        const datasources = await vectorDB.listDatasources('demo-documents');
        console.log(`Found ${datasources.length} datasources:`);
        datasources.forEach((ds, index) => {
            console.log(`  ${index + 1}. ${ds.id}: ${ds.metadata?.label}`);
        });

        console.log('\n🧹 Cleaning up...');
        await vectorDB.deleteNamespace('demo-documents');
        
        console.log('✅ Weaviate VectorDB Connector Demo completed successfully!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateWeaviateConnector().catch(console.error);
}

export { demonstrateWeaviateConnector };
