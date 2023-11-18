import { Module } from '@nestjs/common';
import { EmailConfirmationController } from './emailConfirmation.controller';
import { EmailConfirmationService } from './emailConfirmation.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { UsersModule } from '@modules/users/users.module';

@Module({
	imports: [ConfigModule, JwtModule, MailerModule, UsersModule],
	controllers: [EmailConfirmationController],
	providers: [EmailConfirmationService],
	exports: [],
})
export class EmailConfirmationModule {}
