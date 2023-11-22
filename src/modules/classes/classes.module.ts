import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { ClassesRepository } from '@repositories/classes.repository';
import { Class, ClassSchemaFactory } from './entities/class.entity';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '@modules/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
	imports: [
		MongooseModule.forFeatureAsync([
			{
				name: Class.name,
				imports: [ConfigModule],
				inject: [ConfigService],
				useFactory: ClassSchemaFactory,
			},
		]),
		UsersModule,
		ConfigModule,
		JwtModule,
		MailerModule,
	],
	controllers: [ClassesController],
	providers: [
		ClassesService,
		{ provide: 'ClassesRepositoryInterface', useClass: ClassesRepository },
	],
	exports: [ClassesService],
})
export class ClassesModule {}
