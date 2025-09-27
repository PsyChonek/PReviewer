import { AIProviderConfig } from '../types';
import { getDefaultPrompts } from '../utils/config';

export interface AppConfiguration {
  aiConfig: AIProviderConfig;
  basePrompt: string;
  userPrompt: string;
  debugMode: boolean;
}

export class ConfigurationService {
  private static instance: ConfigurationService;
  private readonly STORAGE_KEYS = {
    AI_CONFIG: 'aiConfig',
    BASE_PROMPT: 'basePrompt',
    USER_PROMPT: 'userPrompt',
    DEBUG_MODE: 'debugMode'
  };

  private constructor() {}

  static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  loadConfiguration(): AppConfiguration {
    const defaultConfig: AppConfiguration = {
      aiConfig: {
        provider: 'ollama',
        ollama: {
          url: 'http://localhost:11434/api/generate',
          model: 'codellama'
        },
        azure: {
          endpoint: '',
          apiKey: '',
          deployment: ''
        }
      },
      basePrompt: getDefaultPrompts().basePrompt,
      userPrompt: '',
      debugMode: false
    };

    try {
      // Load AI config
      const savedAiConfig = localStorage.getItem(this.STORAGE_KEYS.AI_CONFIG);
      if (savedAiConfig) {
        defaultConfig.aiConfig = JSON.parse(savedAiConfig);
      }

      // Load base prompt
      const savedBasePrompt = localStorage.getItem(this.STORAGE_KEYS.BASE_PROMPT);
      if (savedBasePrompt) {
        defaultConfig.basePrompt = savedBasePrompt;
      }

      // Load user prompt
      const savedUserPrompt = localStorage.getItem(this.STORAGE_KEYS.USER_PROMPT);
      if (savedUserPrompt) {
        defaultConfig.userPrompt = savedUserPrompt;
      }

      // Load debug mode
      const savedDebugMode = localStorage.getItem(this.STORAGE_KEYS.DEBUG_MODE);
      if (savedDebugMode) {
        defaultConfig.debugMode = savedDebugMode === 'true';
      }

      return defaultConfig;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      return defaultConfig;
    }
  }

  saveConfiguration(config: AppConfiguration): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.AI_CONFIG, JSON.stringify(config.aiConfig));
      localStorage.setItem(this.STORAGE_KEYS.BASE_PROMPT, config.basePrompt);
      localStorage.setItem(this.STORAGE_KEYS.USER_PROMPT, config.userPrompt);
      localStorage.setItem(this.STORAGE_KEYS.DEBUG_MODE, config.debugMode.toString());
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  saveAiConfig(aiConfig: AIProviderConfig): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.AI_CONFIG, JSON.stringify(aiConfig));
    } catch (error) {
      console.error('Failed to save AI config:', error);
    }
  }

  savePrompts(basePrompt: string, userPrompt: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.BASE_PROMPT, basePrompt);
      localStorage.setItem(this.STORAGE_KEYS.USER_PROMPT, userPrompt);
    } catch (error) {
      console.error('Failed to save prompts:', error);
    }
  }

  saveDebugMode(debugMode: boolean): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.DEBUG_MODE, debugMode.toString());
    } catch (error) {
      console.error('Failed to save debug mode:', error);
    }
  }

  resetPromptsToDefault(): { basePrompt: string; userPrompt: string } {
    const defaults = getDefaultPrompts();
    this.savePrompts(defaults.basePrompt, defaults.userPrompt);
    return defaults;
  }

  clearAllConfiguration(): void {
    try {
      Object.values(this.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to clear configuration:', error);
    }
  }

  exportConfiguration(): string {
    const config = this.loadConfiguration();
    // Don't export sensitive data like API keys
    const exportConfig = {
      ...config,
      aiConfig: {
        ...config.aiConfig,
        azure: {
          ...config.aiConfig.azure,
          apiKey: config.aiConfig.azure.apiKey ? '[REDACTED]' : ''
        }
      }
    };
    return JSON.stringify(exportConfig, null, 2);
  }

  importConfiguration(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson) as AppConfiguration;

      // Validate the structure
      if (!config.aiConfig || !config.basePrompt) {
        throw new Error('Invalid configuration format');
      }

      // Don't import API keys that are redacted
      if (config.aiConfig.azure.apiKey === '[REDACTED]') {
        const currentConfig = this.loadConfiguration();
        config.aiConfig.azure.apiKey = currentConfig.aiConfig.azure.apiKey;
      }

      this.saveConfiguration(config);
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }
}

export const configService = ConfigurationService.getInstance();