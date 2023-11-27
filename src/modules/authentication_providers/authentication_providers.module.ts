import { Module } from '@nestjs/common';
import { AuthenticationProvidersService } from './authentication_providers.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
	AuthenticationProvider,
	AuthenticationProviderSchema,
} from './entity/authentication_provider.entity';
import { AuthenticationProvidersRepository } from '@repositories/authentication-providers.repository';

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: AuthenticationProvider.name,
				schema: AuthenticationProviderSchema,
			},
		]),
	],
	providers: [
		AuthenticationProvidersService,
		{
			provide: 'AuthenticationProvidersRepositoryInterface',
			useClass: AuthenticationProvidersRepository,
		},
	],
	exports: [AuthenticationProvidersService],
})
export class AuthenticationProvidersModule {}
