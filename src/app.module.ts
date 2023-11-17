import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { database_config } from '@configs/configuration.config';
import { UsersModule } from '@modules/users/users.module';
import { UserRolesModule } from '@modules/user-roles/user-roles.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { EmailConfirmationModule } from '@modules/emailConfirmation/emailConfirmation.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			validationSchema: Joi.object({
				NODE_ENV: Joi.string()
					.valid('development', 'production', 'test', 'provision')
					.default('development'),
				PORT: Joi.number().port().default(3000),
				DATABASE_PORT: Joi.number().port().required(),
				DATABASE_USERNAME: Joi.string().min(4).required(),
				DATABASE_PASSWORD: Joi.string().min(4).required(),
				DATABASE_HOST: Joi.string().required(),
				DATABASE_URI: Joi.string().required(),
				MAIL_USER: Joi.string().required(),
				MAIL_PASS: Joi.string().required(),
			}),
			validationOptions: {
				abortEarly: false,
			},
			load: [database_config],
			isGlobal: true,
			cache: true,
			expandVariables: true,
			envFilePath: `.env${
				process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''
			}`,
		}),
		MongooseModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				uri: configService.get<string>('DATABASE_URI'),
				dbName: configService.get<string>('DATABASE_NAME'),
			}),
			inject: [ConfigService],
		}),
		MailerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => ({
				transport: {
					service: 'gmail',
					auth: {
						user: configService.get<string>('MAIL_USER'),
						pass: configService.get<string>('MAIL_PASS'),
					},
				},
				defaults: {
					from: 'awp.classroom.mail@gmail.com',
				},
				template: {
					dir: __dirname + '/templates',
					adapter: new HandlebarsAdapter(),
					options: {
						strict: true,
					},
				},
			}),
		}),
		UserRolesModule,
		UsersModule,
		AuthModule,
		EmailConfirmationModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
