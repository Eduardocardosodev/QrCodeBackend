import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateQrCodeBatchDto,
  MAX_BATCH_QUANTITY,
} from './create-qr-code-batch.dto';

describe('CreateQrCodeBatchDto', () => {
  const validPayload = {
    prefix: 'Cliente',
    quantity: 10,
    destinationUrl: 'https://example.com/padrao',
    folderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };

  async function validateDto(payload: Record<string, unknown>) {
    const dto = plainToInstance(CreateQrCodeBatchDto, payload);
    return validate(dto);
  }

  it('deve aceitar payload válido', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('deve rejeitar quantity abaixo de 1', async () => {
    const errors = await validateDto({ ...validPayload, quantity: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('deve rejeitar quantity acima do limite', async () => {
    const errors = await validateDto({
      ...validPayload,
      quantity: MAX_BATCH_QUANTITY + 1,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('deve rejeitar URL inválida', async () => {
    const errors = await validateDto({
      ...validPayload,
      destinationUrl: 'not-a-url',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('deve rejeitar folderId inválido', async () => {
    const errors = await validateDto({
      ...validPayload,
      folderId: 'invalid-uuid',
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
