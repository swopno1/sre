# How to run the tests

Many tests in this repository rely on SRE vault file. the vault file stores API keys for the LLM providers and other third-party services.

in order to run the tests with LLM providers, you need to create a vault file in your user home directory under ~/.smyth/.sre/vault.json (%userprofile%/.smyth/.sre/vault.json on Windows)

the file content should be like this:

```json
    "default": {
        "echo": "",
        "openai": "",
        "anthropic": "",
        "googleai": "",
        "groq": "",
        "togetherai": "",
        "xai": "",
        "deepseek": "",
    },
```

# Important Notes

Running the tests that use LLMs providers incure costs.
