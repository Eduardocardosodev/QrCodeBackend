import { BasicUserAgentParser } from './basic-user-agent.parser';

describe('BasicUserAgentParser', () => {
  const parser = new BasicUserAgentParser();

  it('deve identificar iPhone como mobile iOS Safari', () => {
    const result = parser.parse(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );

    expect(result.deviceType).toBe('mobile');
    expect(result.operatingSystem).toBe('iOS');
    expect(result.browser).toBe('Safari');
  });

  it('deve identificar Android como mobile', () => {
    const result = parser.parse(
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    );

    expect(result.deviceType).toBe('mobile');
    expect(result.operatingSystem).toBe('Android');
    expect(result.browser).toBe('Chrome');
  });

  it('deve retornar unknown quando user-agent estiver ausente', () => {
    const result = parser.parse(null);

    expect(result.deviceType).toBe('unknown');
    expect(result.operatingSystem).toBeNull();
    expect(result.browser).toBeNull();
  });
});
