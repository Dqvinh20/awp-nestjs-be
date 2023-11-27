import { AuthenticationProvidersModule } from './../authentication_providers/authentication_providers.module';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { UsersModule } from '@modules/users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtAccessTokenStrategy } from './strategies/jwt-access-token.strategy';
import { JwtRefreshTokenStrategy } from './strategies/jwt-refresh-token.strategy';
import { EmailConfirmationService } from '@modules/emailConfirmation/emailConfirmation.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { ConfigModule } from '@nestjs/config';
import { FacebookStrategy } from './strategies/facebook.strategy';

@Module({
	imports: [
		UsersModule,
		ConfigModule,
		AuthenticationProvidersModule,
		PassportModule,
		JwtModule.register({}),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		LocalStrategy,
		JwtAccessTokenStrategy,
		JwtRefreshTokenStrategy,
		EmailConfirmationService,
		GoogleStrategy,
		FacebookStrategy,
	],
})
export class AuthModule {}
