import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configSwagger } from '@configs/api-docs.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
	const logger = new Logger(bootstrap.name);
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.use(cookieParser());
	app.use(helmet());
	app.enableCors({
		origin: true,
		credentials: true,
		exposedHeaders: ['content-disposition'],
	});
	const config_service = app.get(ConfigService);
	app.useStaticAssets(join(__dirname, './served'));
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
		}),
	);
	app.setGlobalPrefix('api');
	configSwagger(app);
	await app.listen(config_service.get('PORT'), () =>
		logger.log(`Application running on port ${config_service.get('PORT')}`),
	);
}
bootstrap();
