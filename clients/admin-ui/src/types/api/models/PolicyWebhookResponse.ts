/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ConnectionConfigurationResponse } from "./ConnectionConfigurationResponse";
import type { WebhookDirection } from "./WebhookDirection";

/**
 * Response schema after creating a PolicyWebhook
 */
export type PolicyWebhookResponse = {
  direction: WebhookDirection;
  key?: string;
  name?: string;
  connection_config?: ConnectionConfigurationResponse;
  order: number;
};
