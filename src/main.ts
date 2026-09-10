import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // #region agent log
  void fetch('http://127.0.0.1:7599/ingest/e893a9a0-183c-4784-9a98-bc1d32410156',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ae56dc'},body:JSON.stringify({sessionId:'ae56dc',runId:'initial',hypothesisId:'H4',location:'src/main.ts:6',message:'Nest entrypoint loaded',data:{cwd:process.cwd(),entrypoint:__filename},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Listen on all interfaces so Render can detect the open port
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
