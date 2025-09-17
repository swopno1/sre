import EventEmitter from 'events';
import OpenAI from 'openai';
import { toFile } from 'openai';
import { encodeChat } from 'gpt-tokenizer';
import { BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import {
    TLLMParams,
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
    ILLMRequestFuncParams,
    TOpenAIRequestBody,
    TLLMChatResponse,
    ILLMRequestContext,
    BasicCredentials,
    TLLMPreparedParams,
    TCustomLLMModel,
} from '@sre/types/LLM.types';
import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { LLMStream } from '../LLMConnector';
const logger = Logger('CustomConnector');
export class CustomConnector extends LLMConnector {
    public name = 'LLM:Custom';
    constructor() {
        super();
    }
    protected async getClient(params: ILLMRequestContext): Promise<OpenAI> {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;
        const baseURL = params?.modelInfo?.baseURL;
        const dangerouslyAllowBrowser = true;

        const openai = new OpenAI({ baseURL, apiKey, dangerouslyAllowBrowser });
        return openai;
    }
    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const _body = body as OpenAI.ChatCompletionCreateParams;
            const client = await this.getClient(context);
            const result = await client.chat.completions.create(body as OpenAI.Chat.CompletionCreateParams);
            const message = result?.choices?.[0]?.message;
            const finishReason = result?.choices?.[0]?.finish_reason || 'stop';
            let toolsData: ToolData[] = [];
            let useTool = false;
            if (finishReason === 'tool_calls') {
                toolsData =
                    message?.tool_calls?.map((tool, index) => ({
                        index,
                        id: tool?.id,
                        type: tool?.type,
                        name: tool?.function?.name,
                        arguments: tool?.function?.arguments,
                        role: 'tool',
                    })) || [];
                useTool = true;
            }
            const usage = result?.usage;
            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });
            return {
                content: message?.content ?? '',
                finishReason,
                useTool,
                toolsData,
                message,
                usage,
            };
        } catch (error) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }
    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        try {
            logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
            const client = await this.getClient(context);
            const stream = await client.chat.completions.create(body as OpenAI.Chat.CompletionCreateParams);
            const emitter = new LLMStream();
            (async () => {
                for await (const chunk of stream) {
                    emitter.enqueueData(chunk);
                }
                emitter.endStream();
            })();
            return emitter;
        } catch (error) {
            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }
    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<TOpenAIRequestBody> {
        const {
            model,
            messages,
            maxTokens,
            temperature,
            topP,
            stopSequences,
            presencePenalty,
            frequencyPenalty,
            tools,
            tool_choice,
            responseFormat,
        } = params;
        const body: TOpenAIRequestBody = {
            model: model as string,
            messages,
            max_tokens: maxTokens,
            temperature: temperature || 1,
            top_p: topP || 1,
        };
        if (stopSequences?.length > 0) {
            body.stop = stopSequences;
        }
        if (presencePenalty) {
            body.presence_penalty = presencePenalty;
        }
        if (frequencyPenalty) {
            body.frequency_penalty = frequencyPenalty;
        }
        if (tools?.length > 0) {
            body.tools = tools;
            body.tool_choice = tool_choice;
        }
        if (responseFormat) {
            body.response_format = { type: responseFormat };
        }
        return body;
    }
    protected reportUsage(
        usage: OpenAI.Completions.CompletionUsage,
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');
        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage?.prompt_tokens,
            output_tokens: usage?.completion_tokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);
        return usageData;
    }
}
