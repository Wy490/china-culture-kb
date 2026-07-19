import { describe, expect, it } from 'vitest';
import {
  classifySeedanceProviderFailure,
  normalizeSeedanceShotCallbackStatus,
  seedanceShotStatusText,
} from '../services/seedance-provider-callback-policy-service.js';

describe('seedance provider callback policy service', () => {
  it('normalizes provider status aliases before using artifact fallbacks', () => {
    expect(normalizeSeedanceShotCallbackStatus('successed', false, false)).toBe('ready');
    expect(normalizeSeedanceShotCallbackStatus('cancelled', true, false)).toBe('failed');
    expect(normalizeSeedanceShotCallbackStatus('waiting', false, false)).toBe('submitted');
    expect(normalizeSeedanceShotCallbackStatus('unknown', true, false)).toBe('ready');
    expect(normalizeSeedanceShotCallbackStatus('unknown', false, true)).toBe('failed');
    expect(normalizeSeedanceShotCallbackStatus(undefined, false, false)).toBe('processing');
  });

  it('gives an explicit stable failure category precedence over provider text', () => {
    expect(classifySeedanceProviderFailure({
      explicitCategory: 'provider_auth',
      providerErrorCode: 'ASSET_NOT_FOUND',
      failureReason: 'missing image',
    })).toBe('provider_auth');
  });

  it('classifies stable provider error codes before localized free text', () => {
    expect(classifySeedanceProviderFailure({ providerErrorCode: 'INVALID_SIGNATURE' }))
      .toBe('provider_auth');
    expect(classifySeedanceProviderFailure({ providerErrorCode: 'HTTP_503' }))
      .toBe('provider_server_error');
    expect(classifySeedanceProviderFailure({ failureReason: '平台额度不足，请充值' }))
      .toBe('provider_quota');
    expect(classifySeedanceProviderFailure({ message: 'unmapped provider failure' }))
      .toBe('unknown');
    expect(classifySeedanceProviderFailure({})).toBeUndefined();
  });

  it('keeps operator-facing status labels stable', () => {
    expect(seedanceShotStatusText('not_started')).toBe('未开始');
    expect(seedanceShotStatusText('processing')).toBe('处理中');
    expect(seedanceShotStatusText('ready')).toBe('已完成');
    expect(seedanceShotStatusText('failed')).toBe('失败');
  });
});
