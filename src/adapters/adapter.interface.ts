import { ActivityType, AdapterHealth, Provider } from '../types/events';
import { RawEventInput } from '../pipeline/normalizer';

export interface AgentAdapter {
  readonly id: Provider;
  readonly name: string;
  readonly supportedEventTypes: ActivityType[];

  isAvailable(): Promise<boolean>;
  initialize(onEvent: (event: RawEventInput) => void): Promise<void>;
  dispose(): Promise<void> | void;
  getHealth(): AdapterHealth;
}
